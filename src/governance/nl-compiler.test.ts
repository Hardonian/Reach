import { describe, expect, it } from "vitest";
import { compileGovernanceIntent } from "../../packages/core/src/nl-compiler/compiler.js";

describe("nl-compiler determinism", () => {
  it("produces identical hash for identical intent", () => {
    const input = {
      intent:
        "Make sure no PR deploys unless evaluation score >= 0.9 and require provenance for all generated artifacts.",
      orgId: "org-a",
      workspaceId: "workspace-a",
      scope: "project" as const,
      memory: [],
      defaultRolloutMode: "dry-run" as const,
    };

    const first = compileGovernanceIntent(input);
    const second = compileGovernanceIntent(input);

    expect(first.specHash).toBe(second.specHash);
    expect(first.canonicalSpec).toBe(second.canonicalSpec);
    expect(first.spec.rolloutMode).toBe("dry-run");
    expect(first.spec.gates.length).toBeGreaterThan(0);
  });

  it("uses memory baselines for ambiguous safety intent", () => {
    const compiled = compileGovernanceIntent({
      intent: "Make this safer.",
      orgId: "org-a",
      workspaceId: "workspace-a",
      scope: "project",
      memory: [
        {
          orgId: "org-a",
          workspaceId: "workspace-a",
          scope: "project",
          memoryType: "eval_baseline",
          content: { evaluation_min: 0.93, hallucination_max: 0.07 },
          confidence: 0.92,
        },
      ],
      defaultRolloutMode: "dry-run",
    });

    const evalThreshold = compiled.spec.thresholds.find(
      (threshold) => threshold.metric === "evaluation_score",
    );
    const hallucinationThreshold = compiled.spec.thresholds.find(
      (threshold) => threshold.metric === "hallucination_risk",
    );

    expect(evalThreshold?.value).toBe(0.93);
    expect(hallucinationThreshold?.value).toBe(0.07);
  });
});
