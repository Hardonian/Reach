/**
 * Example PR Analyzer Plugin
 *
 * Demonstrates how to create a custom analyzer for Reach.
 * This analyzer checks for common code quality issues.
 */

module.exports = {
  /**
   * Register analyzers with Reach
   * @returns {Object} Analyzers to register
   */
  register() {
    return {
      analyzers: [
        {
          id: "example-complexity-check",
          category: "quality",
          deterministic: true,
          description: "Checks for overly complex functions",

          /**
           * Analyze input for complexity issues
           * @param {Object} input - Analysis input
           * @param {string} input.content - Content to analyze
           * @param {string} input.filename - Name of file
           * @returns {Array} Analysis findings
           */
          analyze(input) {
            const findings = [];
            const lines = input.content.split("\n");

            // Check for long functions (simple heuristic)
            let functionLength = 0;
            let inFunction = false;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];

              // Detect function start (simplified)
              if (/^\\s*(function|const|let|var)\\s+\\w+\\s*[=\\(]/.test(line)) {
                inFunction = true;
                functionLength = 1;
              } else if (inFunction) {
                functionLength++;

                // Check for function end (simplified)
                if (line.trim() === "}") {
                  if (functionLength > 50) {
                    findings.push({
                      type: "warning",
                      message: `Function is ${functionLength} lines (consider refactoring)`,
                      line: i - functionLength + 1,
                      severity: "medium",
                      rule: "function-length",
                    });
                  }
                  inFunction = false;
                }
              }

              // Check for TODO comments
              if (line.includes("TODO") || line.includes("FIXME")) {
                findings.push({
                  type: "info",
                  message: `Found ${line.includes("TODO") ? "TODO" : "FIXME"} comment`,
                  line: i + 1,
                  severity: "low",
                  rule: "todo-comment",
                });
              }

              // Check for console.log
              if (line.includes("console.log(")) {
                findings.push({
                  type: "warning",
                  message: "console.log found (remove before production)",
                  line: i + 1,
                  severity: "low",
                  rule: "no-console-log",
                });
              }
            }

            return findings;
          },
        },

        {
          id: "example-security-check",
          category: "security",
          deterministic: true,
          description: "Basic security checks",

          analyze(input) {
            const findings = [];
            const content = input.content;

            // Check for potential secrets
            const secretPatterns = [
              {
                pattern: /password\\s*=\\s*["'][^"']+["']/i,
                desc: "Hardcoded password",
              },
              {
                pattern: /api[_-]?key\\s*=\\s*["'][^"']+["']/i,
                desc: "Hardcoded API key",
              },
              {
                pattern: /secret\\s*=\\s*["'][^"']+["']/i,
                desc: "Hardcoded secret",
              },
            ];

            for (const { pattern, desc } of secretPatterns) {
              if (pattern.test(content)) {
                findings.push({
                  type: "error",
                  message: desc,
                  severity: "high",
                  rule: "no-hardcoded-secrets",
                });
              }
            }

            // Check for eval usage
            if (/\\beval\\s*\\(/.test(content)) {
              findings.push({
                type: "warning",
                message: "eval() usage detected (security risk)",
                severity: "high",
                rule: "no-eval",
              });
            }

            return findings;
          },
        },
      ],
    };
  },
};
