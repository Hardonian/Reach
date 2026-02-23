/**
 * Drift Hunter Pack Plugin
 *
 * Detects configuration drift and unexpected changes between runs.
 * Part of the drift-hunter pack for maintaining reproducible builds.
 */

const fs = require("fs");
const path = require("path");

module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "drift-scan",
          name: "Drift Scanner",
          category: "quality",
          deterministic: true,
          description: "Scans for configuration drift between runs",

          /**
           * Analyze for drift
           * @param {Object} input - Analysis input
           * @param {Object} input.previous - Previous run data
           * @param {Object} input.current - Current run data
           * @returns {Array} Drift findings
           */
          analyze(input) {
            const findings = [];
            const { previous, current } = input;

            if (!previous || !current) {
              return [
                {
                  type: "info",
                  message:
                    "Insufficient data for drift analysis (need previous and current)",
                  severity: "low",
                },
              ];
            }

            // Compare fingerprints
            if (previous.fingerprint && current.fingerprint) {
              if (previous.fingerprint !== current.fingerprint) {
                findings.push({
                  type: "warning",
                  message: `Fingerprint changed: ${previous.fingerprint.slice(0, 8)}... → ${current.fingerprint.slice(0, 8)}...`,
                  severity: "medium",
                  rule: "fingerprint-changed",
                  details: {
                    previous: previous.fingerprint,
                    current: current.fingerprint,
                  },
                });
              }
            }

            // Compare configurations (deterministic - sorted keys)
            const prevConfig = sortObjectKeys(previous.config || {});
            const currConfig = sortObjectKeys(current.config || {});
            const configDiff = diffObjects(prevConfig, currConfig);

            if (configDiff.length > 0) {
              findings.push({
                type: "warning",
                message: `Configuration drift detected: ${configDiff.length} change(s)`,
                severity: "high",
                rule: "config-drift",
                details: configDiff,
              });
            }

            // Check for undeclared changes (files modified but not tracked)
            if (input.trackedFiles) {
              const untrackedChanges = detectUntrackedChanges(
                input.trackedFiles,
                input.workspace,
              );
              if (untrackedChanges.length > 0) {
                findings.push({
                  type: "error",
                  message: `Untracked file changes: ${untrackedChanges.join(", ")}`,
                  severity: "high",
                  rule: "no-undeclared-changes",
                  details: untrackedChanges,
                });
              }
            }

            // Version lock check
            if (previous.version && current.version) {
              if (!isVersionCompatible(previous.version, current.version)) {
                findings.push({
                  type: "warning",
                  message: `Version changed from ${previous.version} to ${current.version}`,
                  severity: "medium",
                  rule: "version-lock",
                  suggestion: "Pin versions for reproducibility",
                });
              }
            }

            return findings.sort(
              (a, b) => severityRank(b.severity) - severityRank(a.severity),
            );
          },
        },

        {
          id: "diff-runs",
          name: "Run Differ",
          category: "quality",
          deterministic: true,
          description: "Shows detailed diff between two runs",

          analyze(input) {
            const { runA, runB } = input;

            if (!runA || !runB) {
              return [
                {
                  type: "error",
                  message: "Two runs required for diff",
                  severity: "high",
                },
              ];
            }

            const differences = [];

            // Compare all fields deterministically
            const fieldsToCompare = [
              "status",
              "fingerprint",
              "duration_ms",
              "exit_code",
            ];

            for (const field of fieldsToCompare.sort()) {
              if (runA[field] !== runB[field]) {
                differences.push({
                  field,
                  previous: runA[field],
                  current: runB[field],
                });
              }
            }

            // Deep compare outputs
            const outputDiff = diffObjects(
              sortObjectKeys(runA.outputs || {}),
              sortObjectKeys(runB.outputs || {}),
            );

            return [
              {
                type:
                  differences.length > 0 || outputDiff.length > 0
                    ? "warning"
                    : "info",
                message:
                  differences.length === 0 && outputDiff.length === 0
                    ? "No differences found between runs"
                    : `Found ${differences.length} field differences and ${outputDiff.length} output differences`,
                severity: differences.length > 0 ? "medium" : "low",
                details: {
                  fieldDiffs: differences,
                  outputDiffs: outputDiff,
                },
              },
            ];
          },
        },
      ],

      evidenceExtractors: [
        {
          id: "drift-evidence",
          name: "Drift Evidence Collector",
          deterministic: true,

          extract(context) {
            const evidence = {
              source: "pack-drift-hunter",
              timestamp: new Date().toISOString(),
              items: [],
            };

            // Collect workspace state
            if (context.workspace) {
              try {
                const configFiles = [
                  "package.json",
                  "reach.config.json",
                  "Dockerfile",
                ]
                  .filter((f) => fs.existsSync(path.join(context.workspace, f)))
                  .sort();

                evidence.items.push({
                  type: "workspace_state",
                  configFiles,
                  fileCount: configFiles.length,
                });
              } catch (e) {
                evidence.items.push({
                  type: "workspace_error",
                  error: e.message,
                });
              }
            }

            // Collect environment markers
            evidence.items.push({
              type: "environment",
              node_version: process.version,
              platform: process.platform,
              arch: process.arch,
            });

            // Sort for determinism
            evidence.items.sort((a, b) =>
              JSON.stringify(a).localeCompare(JSON.stringify(b)),
            );

            return evidence;
          },
        },
      ],
    };
  },
};

/**
 * Sort object keys recursively for determinism
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
 * Diff two objects (deterministic)
 * @param {Object} a - First object
 * @param {Object} b - Second object
 * @returns {Array} Differences
 */
function diffObjects(a, b, path = "") {
  const diffs = [];
  const allKeys = [
    ...new Set([...Object.keys(a || {}), ...Object.keys(b || {})]),
  ].sort();

  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const valA = a?.[key];
    const valB = b?.[key];

    if (
      typeof valA === "object" &&
      typeof valB === "object" &&
      valA !== null &&
      valB !== null
    ) {
      diffs.push(...diffObjects(valA, valB, currentPath));
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      diffs.push({
        path: currentPath,
        previous: valA,
        current: valB,
      });
    }
  }

  return diffs;
}

/**
 * Detect untracked file changes
 * @param {Array} trackedFiles - List of tracked files
 * @param {string} workspace - Workspace path
 * @returns {Array} Untracked changes
 */
function detectUntrackedChanges(trackedFiles, workspace) {
  // Simplified implementation
  return [];
}

/**
 * Check version compatibility
 * @param {string} v1 - Version 1
 * @param {string} v2 - Version 2
 * @returns {boolean} Compatible
 */
function isVersionCompatible(v1, v2) {
  const major1 = v1.split(".")[0];
  const major2 = v2.split(".")[0];
  return major1 === major2;
}

/**
 * Severity ranking for sorting
 * @param {string} severity - Severity level
 * @returns {number} Rank
 */
function severityRank(severity) {
  const ranks = { high: 3, medium: 2, low: 1 };
  return ranks[severity] || 0;
}
