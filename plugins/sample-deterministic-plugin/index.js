/**
 * Sample Deterministic Plugin
 *
 * A minimal example of a deterministic plugin that produces
 * identical output for identical input (required for replay).
 */

module.exports = {
  /**
   * Register with Reach
   * @returns {Object} Plugin capabilities
   */
  register() {
    return {
      decisionTypes: [
        {
          id: "deterministic-choice",
          name: "Deterministic Choice",
          description: "Makes choices based on seeded random for reproducibility",
          deterministic: true,

          /**
           * Make a deterministic choice
           * @param {Object} params - Decision parameters
           * @param {string} params.seed - Random seed for reproducibility
           * @param {Array} params.options - Options to choose from
           * @returns {Object} Deterministic decision result
           */
          decide(params) {
            const { seed, options } = params;

            if (!Array.isArray(options) || options.length === 0) {
              throw new Error("Options must be a non-empty array");
            }

            // Deterministic random based on seed
            const random = seededRandom(seed || "default");
            const selectedIndex = Math.floor(random() * options.length);
            const selected = options[selectedIndex];

            // Sort evidence for determinism
            const evidence = [
              {
                type: "seed",
                value: seed,
                description: "Deterministic seed used for selection",
              },
              {
                type: "random_value",
                value: random(),
                description: "Generated random value (deterministic)",
              },
              {
                type: "option_count",
                value: options.length,
                description: `Selected from ${options.length} options`,
              },
            ].sort((a, b) => a.type.localeCompare(b.type));

            return {
              selected,
              selected_index: selectedIndex,
              options_considered: options.length,
              evidence,
              fingerprint: generateFingerprint(seed, options),
              timestamp: new Date().toISOString(),
            };
          },
        },
      ],

      analyzers: [
        {
          id: "determinism-check",
          category: "quality",
          deterministic: true,
          description: "Checks input for determinism issues",

          analyze(input) {
            const findings = [];

            // Check for non-deterministic patterns
            const content = JSON.stringify(input);

            // Check for Date.now() usage
            if (content.includes("Date.now()") || content.includes("new Date()")) {
              findings.push({
                type: "warning",
                message: "Date.now() or new Date() detected - may affect determinism",
                severity: "medium",
                rule: "avoid-date-now",
                suggestion: "Use a fixed timestamp or pass date as parameter",
              });
            }

            // Check for Math.random()
            if (content.includes("Math.random()")) {
              findings.push({
                type: "error",
                message: "Math.random() detected - breaks determinism",
                severity: "high",
                rule: "no-math-random",
                suggestion: "Use seeded random number generator",
              });
            }

            // Check for unsorted arrays that might affect hashing
            if (input.options && Array.isArray(input.options)) {
              const sorted = [...input.options].sort((a, b) => {
                const aStr = JSON.stringify(a);
                const bStr = JSON.stringify(b);
                return aStr.localeCompare(bStr);
              });
              const original = JSON.stringify(input.options);
              const sortedStr = JSON.stringify(sorted);

              if (original !== sortedStr) {
                findings.push({
                  type: "info",
                  message: "Options array not sorted - consider sorting for determinism",
                  severity: "low",
                  rule: "sort-options",
                  suggestion: "Sort options before processing",
                });
              }
            }

            return findings.sort((a, b) => a.message.localeCompare(b.message));
          },
        },
      ],
    };
  },
};

/**
 * Seeded random number generator (deterministic)
 * @param {string} seed - Seed string
 * @returns {Function} Random number generator
 */
function seededRandom(seed) {
  let state = hashString(seed);

  return function () {
    // Linear congruential generator
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Hash string to number (deterministic)
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) & 0xffffffff;
  }
  return Math.abs(hash);
}

/**
 * Generate deterministic fingerprint
 * @param {string} seed - Seed
 * @param {Array} options - Options
 * @returns {string} Fingerprint
 */
function generateFingerprint(seed, options) {
  const content = JSON.stringify({ seed, options: options.sort() });
  return "det_" + hashString(content).toString(16).padStart(8, "0");
}
