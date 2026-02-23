/**
 * Junction Rule Pack Plugin
 *
 * Collection of reusable junction rules for common patterns.
 * Deterministic: all rules produce consistent results.
 */

// Rule: Require minimum evidence count
function requireMinEvidence(decision, options = {}) {
  const min = options.min || 1;
  const count = (decision.evidence || []).length;

  return {
    passed: count >= min,
    reason:
      count >= min
        ? `Has ${count} evidence items (>= ${min})`
        : `Only ${count} evidence items (need ${min})`,
    details: { count, required: min },
  };
}

// Rule: Require specific evidence types
function requireEvidenceTypes(decision, options = {}) {
  const required = options.types || [];
  const evidence = decision.evidence || [];

  const present = new Set(evidence.map((e) => e.type).filter(Boolean));
  const missing = required.filter((t) => !present.has(t));

  return {
    passed: missing.length === 0,
    reason:
      missing.length === 0
        ? `All required types present: ${Array.from(present).sort().join(", ")}`
        : `Missing types: ${missing.sort().join(", ")}`,
    details: {
      required: required.sort(), // Deterministic
      present: Array.from(present).sort(),
      missing: missing.sort(),
    },
  };
}

// Rule: Block if high-risk evidence present
function blockOnHighRisk(decision, options = {}) {
  const riskLevels = options.riskLevels || ["high", "critical"];
  const evidence = decision.evidence || [];

  const highRisk = evidence.filter((e) => riskLevels.includes((e.risk || "").toLowerCase()));

  return {
    passed: highRisk.length === 0,
    reason:
      highRisk.length === 0
        ? "No high-risk evidence found"
        : `Found ${highRisk.length} high-risk items`,
    details: {
      highRiskCount: highRisk.length,
      // Deterministic: sort by ID
      highRiskIds: highRisk.map((e) => e.id).sort(),
    },
  };
}

// Rule: Require all evidence to be signed
function requireSignatures(decision, options = {}) {
  const evidence = decision.evidence || [];
  const unsigned = evidence.filter((e) => !e.signatures || e.signatures.length === 0);

  return {
    passed: unsigned.length === 0,
    reason: unsigned.length === 0 ? "All evidence signed" : `${unsigned.length} items unsigned`,
    details: {
      total: evidence.length,
      signed: evidence.length - unsigned.length,
      // Deterministic: sort
      unsignedIds: unsigned.map((e) => e.id).sort(),
    },
  };
}

// Rule: Expire old decisions
function checkExpiration(decision, options = {}) {
  const maxAge = options.maxAgeMs || 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = options.referenceTime || 0; // Deterministic
  const created = decision.createdAt || 0;
  const age = now - created;

  return {
    passed: age <= maxAge,
    reason:
      age <= maxAge
        ? `Decision age ${age}ms within limit ${maxAge}ms`
        : `Decision expired: age ${age}ms > limit ${maxAge}ms`,
    details: {
      age,
      maxAge,
      created,
      referenceTime: now,
    },
  };
}

module.exports = {
  name: "junction-rule-pack",
  version: "0.1.0",

  register(hooks) {
    hooks.registerPolicy("min-evidence", requireMinEvidence);
    hooks.registerPolicy("required-types", requireEvidenceTypes);
    hooks.registerPolicy("block-high-risk", blockOnHighRisk);
    hooks.registerPolicy("require-signatures", requireSignatures);
    hooks.registerPolicy("check-expiration", checkExpiration);
  },
};
