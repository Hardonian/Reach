/**
 * Replay-First CI Pack Plugin
 *
 * Provides deterministic CI with replay verification.
 * Part of the replay-first-ci pack.
 */

const crypto = require("crypto");

module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "replay-verify",
          name: "Replay Verifier",
          category: "quality",
          deterministic: true,
          description: "Verifies that a run can be replayed with identical results",

          analyze(input) {
            const { original, replay } = input;
            const findings = [];

            if (!original || !replay) {
              return [
                {
                  type: "error",
                  message: "Both original and replay runs required",
                  severity: "high",
                },
              ];
            }

            // Check fingerprint match
            if (original.fingerprint !== replay.fingerprint) {
              findings.push({
                type: "error",
                message: `Fingerprint mismatch: ${original.fingerprint?.slice(0, 16)}... ≠ ${replay.fingerprint?.slice(0, 16)}...`,
                severity: "high",
                rule: "determinism-required",
                details: {
                  original: original.fingerprint,
                  replay: replay.fingerprint,
                },
              });
            } else {
              findings.push({
                type: "success",
                message: "Fingerprints match - deterministic execution verified",
                severity: "low",
              });
            }

            // Check event count
            const originalEvents = original.events?.length || 0;
            const replayEvents = replay.events?.length || 0;

            if (originalEvents !== replayEvents) {
              findings.push({
                type: "warning",
                message: `Event count differs: ${originalEvents} ≠ ${replayEvents}`,
                severity: "high",
                rule: "frozen-artifacts",
              });
            }

            // Compare event sequence (deterministic)
            if (original.events && replay.events) {
              const eventDiffs = compareEventSequences(original.events, replay.events);
              if (eventDiffs.length > 0) {
                findings.push({
                  type: "warning",
                  message: `${eventDiffs.length} event sequence differences`,
                  severity: "medium",
                  details: eventDiffs.slice(0, 5), // Limit for determinism
                });
              }
            }

            // Generate proof certificate
            const proof = generateProof(original, replay);

            return [
              ...findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
              {
                type: "info",
                message: "Replay verification complete",
                severity: "low",
                proof,
              },
            ];
          },
        },

        {
          id: "ci-check",
          name: "CI Readiness Checker",
          category: "quality",
          deterministic: true,
          description: "Checks if a configuration is ready for CI",

          analyze(input) {
            const findings = [];
            const config = input.config || {};

            // Check for determinism flag
            if (!config.deterministic) {
              findings.push({
                type: "error",
                message: "Configuration must have deterministic: true for CI",
                severity: "high",
                rule: "determinism-required",
                suggestion: "Set deterministic: true in your configuration",
              });
            }

            // Check for frozen artifacts
            if (!config.frozen_artifacts) {
              findings.push({
                type: "warning",
                message: "Artifact versions should be pinned (frozen_artifacts)",
                severity: "medium",
                rule: "frozen-artifacts",
                suggestion: "Pin all dependency versions",
              });
            }

            // Check for stable output
            if (!config.stable_output) {
              findings.push({
                type: "info",
                message: "Consider enabling stable_output for consistent results",
                severity: "low",
              });
            }

            // Check for required fields (deterministic order)
            const requiredFields = ["name", "version", "steps"].sort();
            for (const field of requiredFields) {
              if (!config[field]) {
                findings.push({
                  type: "error",
                  message: `Missing required field: ${field}`,
                  severity: "high",
                });
              }
            }

            // Check steps for CI readiness
            if (config.steps) {
              const stepIds = config.steps.map((s) => s.name || s.id).sort();
              if (new Set(stepIds).size !== stepIds.length) {
                findings.push({
                  type: "warning",
                  message: "Duplicate step names detected",
                  severity: "medium",
                });
              }
            }

            return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
          },
        },
      ],

      renderers: {
        "ci-report": {
          description: "CI-friendly report format",
          contentType: "text/plain",

          render(data) {
            const lines = [
              "=== Reach CI Report ===",
              "",
              `Run ID: ${data.id || "unknown"}`,
              `Status: ${data.status || "unknown"}`,
              `Fingerprint: ${data.fingerprint || "none"}`,
              "",
              "## Determinism Check",
              "",
            ];

            if (data.proof) {
              lines.push(`✓ Proof: ${data.proof.verified ? "VALID" : "INVALID"}`);
              lines.push(`  Original: ${data.proof.original_fingerprint?.slice(0, 16)}...`);
              lines.push(`  Replay:   ${data.proof.replay_fingerprint?.slice(0, 16)}...`);
              lines.push(`  Match:    ${data.proof.match ? "YES" : "NO"}`);
            }

            lines.push("");
            lines.push("## Evidence");
            lines.push(`  Items: ${data.evidence?.length || 0}`);

            if (data.findings) {
              lines.push("");
              lines.push("## Findings");
              for (const finding of data.findings.sort(
                (a, b) => severityRank(b.severity) - severityRank(a.severity),
              )) {
                const icon =
                  finding.severity === "high" ? "✗" : finding.severity === "medium" ? "⚠" : "✓";
                lines.push(`  ${icon} [${finding.severity.toUpperCase()}] ${finding.message}`);
              }
            }

            lines.push("");
            lines.push("---");
            lines.push("Generated by pack-replay-first-ci");

            return lines.join("\n");
          },
        },

        "ci-json": {
          description: "CI-friendly JSON format",
          contentType: "application/json",

          render(data) {
            // Deterministic JSON output
            const sorted = sortObjectKeys({
              ...data,
              generated_at: new Date().toISOString(),
              generator: "pack-replay-first-ci",
            });

            return JSON.stringify(sorted, null, 2);
          },
        },
      },
    };
  },
};

/**
 * Compare event sequences (deterministic)
 * @param {Array} eventsA - Original events
 * @param {Array} eventsB - Replay events
 * @returns {Array} Differences
 */
function compareEventSequences(eventsA, eventsB) {
  const diffs = [];
  const maxLen = Math.max(eventsA.length, eventsB.length);

  for (let i = 0; i < maxLen; i++) {
    const evA = eventsA[i];
    const evB = eventsB[i];

    if (!evA || !evB) {
      diffs.push({
        position: i,
        type: "missing",
        original: evA?.type || null,
        replay: evB?.type || null,
      });
      continue;
    }

    if (evA.type !== evB.type) {
      diffs.push({
        position: i,
        type: "mismatch",
        original: evA.type,
        replay: evB.type,
      });
    }
  }

  return diffs;
}

/**
 * Generate proof certificate
 * @param {Object} original - Original run
 * @param {Object} replay - Replay run
 * @returns {Object} Proof
 */
function generateProof(original, replay) {
  const match = original.fingerprint === replay.fingerprint;

  return {
    verified: match,
    original_fingerprint: original.fingerprint,
    replay_fingerprint: replay.fingerprint,
    match,
    timestamp: new Date().toISOString(),
    algorithm: "fingerprint_comparison",
  };
}

/**
 * Sort object keys recursively
 * @param {Object} obj - Object to sort
 * @returns {Object} Sorted object
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}

/**
 * Severity ranking
 * @param {string} severity - Severity level
 * @returns {number} Rank
 */
function severityRank(severity) {
  const ranks = { high: 3, medium: 2, low: 1, success: 0 };
  return ranks[severity] || 0;
}
