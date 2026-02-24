import { compileGovernanceIntent } from "../packages/core/src/nl-compiler/compiler.js";
import { generateGovernanceArtifacts } from "../packages/core/src/codegen/generate.js";

const intent =
  process.argv.slice(2).join(" ") ||
  "Make sure no PR deploys unless evaluation score >= 0.9 and require provenance for generated artifacts.";

const compiled = compileGovernanceIntent({
  intent,
  orgId: "demo-org",
  workspaceId: "demo-workspace",
  scope: "project",
  memory: [
    {
      orgId: "demo-org",
      workspaceId: "demo-workspace",
      scope: "project",
      memoryType: "eval_baseline",
      content: { evaluation_min: 0.88 },
      confidence: 0.82,
    },
  ],
  defaultRolloutMode: "dry-run",
});

const generated = generateGovernanceArtifacts({
  intent,
  spec: compiled.spec,
  specHash: compiled.specHash,
  ciEnforcement: compiled.ciEnforcement,
});

const summary = {
  intent,
  rollout_mode: compiled.spec.rolloutMode,
  spec_hash: compiled.specHash,
  gates: compiled.spec.gates.length,
  thresholds: compiled.spec.thresholds.length,
  ci_workflow: generated.artifacts.find((artifact) => artifact.path.endsWith("reach-gates.yml")),
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
