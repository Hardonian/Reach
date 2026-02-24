import { describe, expect, it } from "vitest";
import { compileGovernanceIntent } from "../../packages/core/src/nl-compiler/compiler.js";
import { generateGovernanceArtifacts } from "../../packages/core/src/codegen/generate.js";

describe("governance codegen", () => {
  it("produces deterministic artifacts in stable order", () => {
    const compiled = compileGovernanceIntent({
      intent: "Block model changes that increase hallucination risk.",
      orgId: "org-a",
      workspaceId: "workspace-a",
      scope: "project",
      memory: [],
      defaultRolloutMode: "dry-run",
    });

    const first = generateGovernanceArtifacts({
      intent: "Block model changes that increase hallucination risk.",
      spec: compiled.spec,
      specHash: compiled.specHash,
      ciEnforcement: compiled.ciEnforcement,
    });

    const second = generateGovernanceArtifacts({
      intent: "Block model changes that increase hallucination risk.",
      spec: compiled.spec,
      specHash: compiled.specHash,
      ciEnforcement: compiled.ciEnforcement,
    });

    expect(first.artifacts.map((artifact) => artifact.path)).toEqual(
      [...first.artifacts.map((artifact) => artifact.path)].sort(),
    );
    expect(first.artifacts).toEqual(second.artifacts);
    expect(
      first.artifacts.some((artifact) => artifact.path === ".github/workflows/reach-gates.yml"),
    ).toBe(true);
  });
});
