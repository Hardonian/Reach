/**
 * Sample Junction Rule Plugin
 *
 * Adds a new junction template for deployment strategy decisions.
 * DETERMINISTIC: Same context → same options and rankings.
 */

module.exports = {
  register() {
    return {
      decisionTypes: [
        {
          id: "deployment-strategy",
          name: "Deployment Strategy Decision",
          description: "Selects optimal deployment strategy based on context",
          deterministic: true,

          /**
           * Create a junction with deployment options
           * @param {Object} context - Deployment context
           * @returns {Object} Junction with options
           */
          createJunction(context) {
            const { service, current_version, target_version, risk_tolerance, traffic_pattern } =
              context || {};

            // Define base options (deterministic order)
            const baseOptions = [
              {
                id: "blue-green",
                name: "Blue-Green Deployment",
                description: "Parallel environments with instant switchover",
                constraints: {
                  requires_extra_capacity: true,
                  downtime: "none",
                  rollback_time: "instant",
                  complexity: "medium",
                },
              },
              {
                id: "canary",
                name: "Canary Deployment",
                description: "Gradual traffic shift with monitoring",
                constraints: {
                  requires_extra_capacity: false,
                  downtime: "none",
                  rollback_time: "fast",
                  complexity: "high",
                },
              },
              {
                id: "rolling",
                name: "Rolling Deployment",
                description: "Sequential instance updates",
                constraints: {
                  requires_extra_capacity: false,
                  downtime: "minimal",
                  rollback_time: "slow",
                  complexity: "low",
                },
              },
            ];

            // Score options based on context (deterministic algorithm)
            const scoredOptions = baseOptions.map((option) => {
              let score = 0.5; // Base score
              let evidence = [];

              // Risk tolerance scoring
              if (risk_tolerance === "low") {
                if (option.id === "blue-green") score += 0.3;
                if (option.id === "canary") score += 0.2;
                evidence.push({
                  type: "risk_analysis",
                  value: risk_tolerance,
                  impact: "positive",
                  description: "Low risk tolerance favors safer deployment methods",
                });
              } else if (risk_tolerance === "high") {
                if (option.id === "rolling") score += 0.2;
                evidence.push({
                  type: "risk_analysis",
                  value: risk_tolerance,
                  impact: "neutral",
                  description: "High risk tolerance allows faster methods",
                });
              }

              // Traffic pattern scoring
              if (traffic_pattern === "spiky") {
                if (option.id === "blue-green") score += 0.2;
                evidence.push({
                  type: "traffic_analysis",
                  value: traffic_pattern,
                  impact: "positive",
                  description: "Spiky traffic benefits from instant rollback capability",
                });
              }

              // Calculate confidence (deterministic)
              const confidence = Math.min(0.95, Math.max(0.5, score + 0.2));

              return {
                ...option,
                score: Math.round(score * 100) / 100,
                confidence: Math.round(confidence * 100) / 100,
                evidence: evidence.sort((a, b) => a.type < b.type ? -1 : (a.type > b.type ? 1 : 0)),
              };
            });

            // Sort by score (deterministic - stable sort)
            const rankedOptions = scoredOptions.sort((a, b) => b.score - a.score);

            return {
              id: `junction-${service || "unknown"}-${Date.now()}`,
              type: "deployment-strategy",
              context: {
                service,
                current_version,
                target_version,
                risk_tolerance,
                traffic_pattern,
              },
              options: rankedOptions,
              selection_criteria: {
                primary: "score",
                minimum_confidence: 0.6,
                tiebreaker: "evidence_count",
              },
              created_at: new Date().toISOString(),
            };
          },

          /**
           * Evaluate a junction against policies
           * @param {Object} junction - The junction to evaluate
           * @param {Array} policies - Policies to apply
           * @returns {Object} Evaluation result
           */
          evaluate(junction, policies) {
            if (!junction || !junction.options) {
              return { valid: false, error: "Invalid junction" };
            }

            // Filter options that meet minimum confidence
            const validOptions = junction.options.filter(
              (opt) => opt.confidence >= (junction.selection_criteria?.minimum_confidence || 0.6),
            );

            // Apply policy checks (simplified)
            const policyViolations = [];
            if (policies) {
              policies.forEach((policy) => {
                if (policy.id === "require-rollback-fast") {
                  const slowRollback = validOptions.filter(
                    (o) => o.constraints.rollback_time === "slow",
                  );
                  if (slowRollback.length > 0) {
                    policyViolations.push({
                      policy: policy.id,
                      violated_by: slowRollback.map((o) => o.id),
                    });
                  }
                }
              });
            }

            // Select best option (deterministic)
            const selected = validOptions[0] || null;

            return {
              valid: validOptions.length > 0,
              options_evaluated: junction.options.length,
              options_valid: validOptions.length,
              selected: selected
                ? {
                    id: selected.id,
                    confidence: selected.confidence,
                    score: selected.score,
                  }
                : null,
              policy_violations: policyViolations,
              rejected_options: validOptions.slice(1).map((o) => ({
                id: o.id,
                reason: "Lower score than selected option",
              })),
            };
          },
        },
      ],
    };
  },
};
