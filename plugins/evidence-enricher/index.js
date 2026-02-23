/**
 * Evidence Enricher Plugin
 *
 * Adds computed metadata to evidence items.
 * Deterministic: same input evidence → same enriched output.
 */

function enrichEvidence(evidence, options = {}) {
  const enrichedFields = options.fields || ["wordCount", "confidence"];

  return {
    ...evidence,
    metadata: {
      ...(evidence.metadata || {}),
      ...(enrichedFields.includes("wordCount")
        ? {
            wordCount: countWords(evidence.content || ""),
          }
        : {}),
      ...(enrichedFields.includes("confidence")
        ? {
            confidence: calculateConfidence(evidence),
          }
        : {}),
      enrichedAt: options.referenceTime || 0, // Deterministic: passed in
    },
  };
}

function countWords(content) {
  // Deterministic: pure string operation
  return content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function calculateConfidence(evidence) {
  // Deterministic scoring based on evidence properties
  let score = 0.5; // base

  if (evidence.source) score += 0.1;
  if (evidence.timestamp) score += 0.1;
  if (evidence.signatures && evidence.signatures.length > 0) score += 0.2;
  if (evidence.content && evidence.content.length > 50) score += 0.1;

  // Deterministic: round to avoid floating point variations
  return Math.round(score * 100) / 100;
}

function extractEvidence(data, context) {
  // Main extraction hook
  if (!data) return null;

  const evidence = Array.isArray(data) ? data : [data];

  // Deterministic: sort by ID for consistent ordering
  return evidence
    .map((e) => enrichEvidence(e, context.options))
    .sort((a, b) => { let ia = a.id || "", ib = b.id || ""; return ia < ib ? -1 : (ia > ib ? 1 : 0); });
}

module.exports = {
  name: "evidence-enricher",
  version: "0.1.0",

  register(hooks) {
    hooks.registerEvidenceExtractor("enrich", extractEvidence);
  },
};
