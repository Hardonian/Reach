/**
 * Sample Summarizer Plugin
 * 
 * Summarizes evidence metadata for quick overview.
 * SAFE: Read-only, no side effects, deterministic.
 */

module.exports = {
  register() {
    return {
      evidenceExtractors: [
        {
          id: "evidence-summary",
          name: "Evidence Metadata Summarizer",
          deterministic: true,
          
          /**
           * Extract summary from evidence collection
           * @param {Object} evidence - Evidence collection
           * @returns {Object} Summary metadata
           */
          extract(evidence) {
            if (!evidence || !Array.isArray(evidence.items)) {
              return {
                summary: "No evidence provided",
                count: 0,
                categories: []
              };
            }
            
            const items = evidence.items;
            
            // Count by category (deterministic - using sort)
            const categoryCount = {};
            items.forEach(item => {
              const cat = item.category || 'uncategorized';
              categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            });
            
            // Sort categories for determinism
            const categories = Object.keys(categoryCount).sort().map(cat => ({
              name: cat,
              count: categoryCount[cat]
            }));
            
            // Calculate confidence statistics
            const confidences = items
              .map(i => i.confidence)
              .filter(c => typeof c === 'number')
              .sort((a, b) => a - b);
            
            const avgConfidence = confidences.length > 0
              ? confidences.reduce((a, b) => a + b, 0) / confidences.length
              : 0;
            
            return {
              summary: `Evidence collection with ${items.length} items`,
              count: items.length,
              categories,
              confidence: {
                average: Math.round(avgConfidence * 100) / 100,
                min: confidences[0] || 0,
                max: confidences[confidences.length - 1] || 0
              },
              timestamp: evidence.timestamp || new Date().toISOString(),
              extractor: "sample-summarizer"
            };
          }
        }
      ],
      
      // Also register as an analyzer for decision insights
      analyzers: [
        {
          id: "evidence-quality-analyzer",
          name: "Evidence Quality Analyzer",
          category: "quality",
          deterministic: true,
          
          analyze(input) {
            const results = [];
            
            if (!input.evidence || input.evidence.length < 2) {
              results.push({
                type: "warning",
                message: "Limited evidence may reduce decision confidence",
                severity: "warning",
                suggestion: "Add more evidence sources"
              });
            }
            
            if (input.evidence) {
              const staleEvidence = input.evidence.filter(e => {
                if (!e.timestamp) return false;
                const age = Date.now() - new Date(e.timestamp).getTime();
                return age > 24 * 60 * 60 * 1000; // Older than 24h
              });
              
              if (staleEvidence.length > 0) {
                results.push({
                  type: "suggestion",
                  message: `${staleEvidence.length} evidence items are older than 24 hours`,
                  severity: "info",
                  suggestion: "Consider refreshing stale evidence"
                });
              }
            }
            
            return results;
          }
        }
      ]
    };
  }
};
