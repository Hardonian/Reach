/**
 * Template Plugin
 *
 * Minimal scaffold for creating Reach plugins.
 * Copy this file and modify for your use case.
 */

module.exports = {
  /**
   * Register function called by Reach to load plugin capabilities
   * @returns {Object} Plugin capabilities
   */
  register() {
    return {
      // Analyzers process inputs and provide insights
      analyzers: [
        {
          id: "template-analyzer",
          name: "Template Analyzer",
          category: "example",
          deterministic: true,

          /**
           * Analyze function
           * @param {Object} input - Input to analyze
           * @returns {Array} Analysis results
           */
          analyze(input) {
            const results = [];

            // Example: Check for a condition
            if (input && input.example) {
              results.push({
                type: "suggestion",
                message: "Example condition detected",
                severity: "info",
                data: { example: input.example },
              });
            }

            return results;
          },
        },
      ],

      // Add other capability registrations here
      // policies: [...]
      // renderers: [...]
      // retrievers: [...]
    };
  },

  /**
   * Optional: Plugin metadata for documentation
   */
  metadata: {
    name: "Template Plugin",
    version: "0.1.0",
    description: "Minimal plugin scaffold",
  },
};
