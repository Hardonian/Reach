/**
 * Security Basics Pack Plugin
 *
 * Essential security checks for workspace integrity.
 * Part of the security-basics pack.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "security-scan",
          name: "Security Scanner",
          category: "security",
          deterministic: true,
          description: "Scans for common security issues",

          analyze(input) {
            const findings = [];
            const { content, filename, workspace } = input;

            // Secret detection patterns (deterministic - sorted)
            const secretPatterns = [
              {
                name: "aws_access_key",
                pattern: /AKIA[0-9A-Z]{16}/,
                description: "AWS Access Key ID",
                severity: "high",
              },
              {
                name: "aws_secret_key",
                pattern: /[0-9a-zA-Z/+]{40}/,
                description: "Potential AWS Secret Key",
                severity: "high",
                context: /aws|secret|key/i,
              },
              {
                name: "generic_api_key",
                pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_-]{16,}["']/i,
                description: "Generic API Key",
                severity: "high",
              },
              {
                name: "private_key",
                pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/,
                description: "Private Key",
                severity: "critical",
              },
              {
                name: "password_assignment",
                pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i,
                description: "Hardcoded password",
                severity: "high",
              },
              {
                name: "token",
                pattern: /token\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/i,
                description: "Token",
                severity: "medium",
              },
            ].sort((a, b) => a.name.localeCompare(b.name));

            if (content) {
              for (const { name, pattern, description, severity, context } of secretPatterns) {
                if (pattern.test(content)) {
                  // Additional context check if specified
                  if (context && !context.test(content)) {
                    continue;
                  }

                  findings.push({
                    type: "error",
                    message: `${description} detected (${name})`,
                    severity,
                    rule: "no-secrets-in-logs",
                    file: filename,
                    details: { pattern: name },
                  });
                }
              }

              // Check for dangerous functions (deterministic - sorted)
              const dangerousFunctions = [
                { name: "eval", pattern: /\beval\s*\(/, severity: "high" },
                { name: "exec", pattern: /\bexec\s*\(/, severity: "medium" },
                {
                  name: "system",
                  pattern: /\bsystem\s*\(/,
                  severity: "medium",
                },
              ].sort((a, b) => a.name.localeCompare(b.name));

              for (const { name, pattern, severity } of dangerousFunctions) {
                if (pattern.test(content)) {
                  findings.push({
                    type: "warning",
                    message: `Dangerous function '${name}()' detected`,
                    severity,
                    rule: "no-unsafe-functions",
                    file: filename,
                    suggestion: `Avoid using ${name}(), use safer alternatives`,
                  });
                }
              }
            }

            // Workspace-level checks
            if (workspace) {
              findings.push(...checkWorkspaceSecurity(workspace));
            }

            return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
          },
        },

        {
          id: "integrity-check",
          name: "Integrity Checker",
          category: "security",
          deterministic: true,
          description: "Verifies artifact and workspace integrity",

          analyze(input) {
            const findings = [];
            const { artifacts, expectedHashes, workspace } = input;

            // Verify artifact hashes
            if (artifacts && expectedHashes) {
              for (const [name, expectedHash] of Object.entries(expectedHashes).sort()) {
                const artifact = artifacts[name];

                if (!artifact) {
                  findings.push({
                    type: "error",
                    message: `Missing artifact: ${name}`,
                    severity: "high",
                    rule: "verified-artifacts-only",
                  });
                  continue;
                }

                const actualHash = hashContent(artifact);

                if (actualHash !== expectedHash) {
                  findings.push({
                    type: "error",
                    message: `Hash mismatch for ${name}: expected ${expectedHash.slice(0, 8)}..., got ${actualHash.slice(0, 8)}...`,
                    severity: "high",
                    rule: "verified-artifacts-only",
                    details: {
                      artifact: name,
                      expected: expectedHash,
                      actual: actualHash,
                    },
                  });
                } else {
                  findings.push({
                    type: "success",
                    message: `Artifact verified: ${name}`,
                    severity: "low",
                  });
                }
              }
            }

            // Check for required security files
            if (workspace) {
              const requiredFiles = [".gitignore"].sort();
              for (const file of requiredFiles) {
                const filePath = path.join(workspace, file);
                if (!fs.existsSync(filePath)) {
                  findings.push({
                    type: "warning",
                    message: `Missing recommended file: ${file}`,
                    severity: "low",
                  });
                }
              }
            }

            return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
          },
        },
      ],

      evidenceExtractors: [
        {
          id: "security-evidence",
          name: "Security Evidence Collector",
          deterministic: true,

          extract(context) {
            const evidence = {
              source: "pack-security-basics",
              timestamp: new Date().toISOString(),
              items: [],
            };

            // Platform info (deterministic subset)
            evidence.items.push({
              type: "platform",
              platform: process.platform,
              arch: process.arch,
              node_version: process.version,
            });

            // Security-relevant environment (sorted)
            const envVars = ["NODE_ENV", "REACH_ENV"].sort();
            evidence.items.push({
              type: "environment",
              vars: envVars.reduce((obj, key) => {
                obj[key] = process.env[key] || null;
                return obj;
              }, {}),
            });

            // File permissions if workspace provided
            if (context.workspace) {
              try {
                const sensitiveFiles = ["reach.config.json", ".env"]
                  .map((f) => path.join(context.workspace, f))
                  .filter((f) => fs.existsSync(f))
                  .sort();

                evidence.items.push({
                  type: "file_permissions",
                  files: sensitiveFiles.map((f) => ({
                    path: path.basename(f),
                    exists: true,
                  })),
                });
              } catch (e) {
                evidence.items.push({
                  type: "file_permissions_error",
                  error: e.message,
                });
              }
            }

            // Sort items for determinism
            evidence.items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

            return evidence;
          },
        },
      ],
    };
  },
};

/**
 * Check workspace security
 * @param {string} workspace - Workspace path
 * @returns {Array} Findings
 */
function checkWorkspaceSecurity(workspace) {
  const findings = [];

  try {
    // Check for .env files that shouldn't be committed
    const envFiles = [".env", ".env.local", ".env.production"].sort();

    for (const envFile of envFiles) {
      const envPath = path.join(workspace, envFile);
      if (fs.existsSync(envPath)) {
        findings.push({
          type: "warning",
          message: `Environment file found: ${envFile} (ensure not committed)`,
          severity: "medium",
          rule: "no-secrets-in-logs",
        });
      }
    }

    // Check for node_modules (should not be committed)
    const nodeModulesPath = path.join(workspace, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      findings.push({
        type: "info",
        message: "node_modules present (ensure in .gitignore)",
        severity: "low",
      });
    }
  } catch (e) {
    findings.push({
      type: "error",
      message: `Workspace check failed: ${e.message}`,
      severity: "medium",
    });
  }

  return findings;
}

/**
 * Hash content consistently
 * @param {string} content - Content to hash
 * @returns {string} Hash
 */
function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Severity ranking
 * @param {string} severity - Severity level
 * @returns {number} Rank
 */
function severityRank(severity) {
  const ranks = { critical: 4, high: 3, medium: 2, low: 1, success: 0 };
  return ranks[severity] || 0;
}
