import { describe, it, expect } from "vitest";
import { executeZeoliteOperation } from "./zeolite-core.js";

describe("zeolite core", () => {
  it("runs deterministic operation chain", () => {
    const loaded = executeZeoliteOperation("load_context", {
      example: "negotiation",
      depth: 2,
      seed: "abc",
    });
    const contextId = String(loaded.contextId);

    const loadedAgain = executeZeoliteOperation("load_context", {
      example: "negotiation",
      depth: 2,
      seed: "abc",
    });
    expect(loadedAgain.contextId).toBe(contextId);

    const submitted = executeZeoliteOperation("submit_evidence", {
      contextId,
      sourceId: "doc",
      claim: "constraint update",
    });
    expect(submitted.evidenceCount).toBe(1);

    const flip = executeZeoliteOperation("compute_flip_distance", {
      contextId,
    });
    expect(Array.isArray(flip.counterfactuals)).toBe(true);

    const voi = executeZeoliteOperation("rank_evidence_by_voi", {
      contextId,
      minEvoi: 0.2,
    });
    expect(Array.isArray(voi.rankings)).toBe(true);

    const plan = executeZeoliteOperation("generate_regret_bounded_plan", {
      contextId,
      horizon: 2,
      minEvoi: 0.2,
    });
    expect(plan.stopConditions).toHaveLength(3);
    expect(typeof plan.terminatedEarly).toBe("boolean");

    const boundary = executeZeoliteOperation("explain_decision_boundary", {
      contextId,
      agentClaim: "commit_now",
    });
    expect((boundary.zeoBoundary as { topAction: string }).topAction).toBe(
      "verify_terms",
    );

    const referee = executeZeoliteOperation("referee_proposal", {
      contextId,
      proposal: { claim: "commit_now" },
    });
    expect((referee.adjudication as { accepted: boolean }).accepted).toBe(
      false,
    );
  });
});
