import { compareStrings, sha256Hex, stableStringifyPretty } from "./deterministic";
import type {
  GenerateGovernanceArtifactsInput,
  GenerateGovernanceArtifactsOutput,
  GovernanceCodegenEngine,
  GovernanceGeneratedArtifact,
} from "./codegen-types";

const CODEGEN_ENGINE: GovernanceCodegenEngine = Object.freeze({
  name: "reach.governance.codegen",
  version: "1.0.0",
});

function makeGateConfigArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const content = stableStringifyPretty({
    version: "reach.governance.gate.v1",
    sourceIntent: input.intent,
    determinismHash: input.specHash,
    generatedSpec: input.spec,
  });

  const outputHash = sha256Hex(content);
  return {
    artifactType: "gate-config",
    path: "governance/reach.governance.json",
    content,
    hash: outputHash,
    outputHash,
    engine: CODEGEN_ENGINE,
  };
}

function makeReplayValidatorArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const content = stableStringifyPretty({
    version: "reach.replay.validator.v1",
    determinismHash: input.specHash,
    policy: {
      replayRequired: Boolean(input.spec.replayPolicy?.required),
      replayMode: input.spec.replayPolicy?.mode ?? "sampled",
      retentionDays: input.spec.replayPolicy?.retentionDays ?? 7,
    },
  });

  const outputHash = sha256Hex(content);
  return {
    artifactType: "replay-validator",
    path: "governance/replay.validator.json",
    content,
    hash: outputHash,
    outputHash,
    engine: CODEGEN_ENGINE,
  };
}

function makePolicyModuleArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const lines = [
    "package reach.governance",
    "",
    "default allow = false",
    "",
    "allow if {",
    `  input.spec_hash == \"${input.specHash}\"`,
    "}",
    "",
    "deny[msg] if {",
    '  input.spec.rolloutMode == "enforced"',
    '  input.result.verdict == "failed"',
    '  msg := "Governance gate failed"',
    "}",
    "",
  ];
  const content = `${lines.join("\n")}`;

  const outputHash = sha256Hex(content);
  return {
    artifactType: "policy-module",
    path: "governance/policy.rego",
    content,
    hash: outputHash,
    outputHash,
    engine: CODEGEN_ENGINE,
  };
}

function makeEvalAdapterArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const content = stableStringifyPretty({
    version: "reach.eval.adapter.v1",
    metrics: input.spec.thresholds.map((threshold) => ({
      metric: threshold.metric,
      operator: threshold.operator,
      value: threshold.value,
    })),
  });

  const outputHash = sha256Hex(content);
  return {
    artifactType: "eval-adapter",
    path: "governance/eval.adapter.json",
    content,
    hash: outputHash,
    outputHash,
    engine: CODEGEN_ENGINE,
  };
}

function makeWorkflowArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const verifyCommand =
    input.ciEnforcement[0]?.verifyCommand ??
    "reach verify --spec governance/reach.governance.json --format json --out .reach/gate-report.json";

  const lines = [
    "name: Reach Governance Gates",
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches: [main]",
    "",
    "jobs:",
    "  reach-gates:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: '20'",
    "      - name: Install Reach CLI",
    '        run: npm i -g @reach/cli || echo "Using repository reach binary"',
    "      - name: Verify governance gates",
    `        run: ${verifyCommand}`,
    "      - name: Upload governance report",
    "        if: always()",
    "        uses: actions/upload-artifact@v4",
    "        with:",
    "          name: reach-gate-report",
    "          path: .reach/gate-report.json",
    "",
  ];

  const content = lines.join("\n");

  const outputHash = sha256Hex(content);
  return {
    artifactType: "ci-workflow",
    path: ".github/workflows/reach-gates.yml",
    content,
    hash: outputHash,
    outputHash,
    engine: CODEGEN_ENGINE,
  };
}

export function generateGovernanceArtifacts(
  input: GenerateGovernanceArtifactsInput,
): GenerateGovernanceArtifactsOutput {
  const artifacts = [
    makeGateConfigArtifact(input),
    makeEvalAdapterArtifact(input),
    makePolicyModuleArtifact(input),
    makeReplayValidatorArtifact(input),
    makeWorkflowArtifact(input),
  ].sort((a, b) => compareStrings(a.path, b.path));

  return {
    artifacts,
    explainability: {
      sourceIntent: input.intent,
      generatedSpec: input.spec,
      determinismHash: input.specHash,
      riskImpactSummary: [
        "Generated artifacts use stable key ordering and deterministic hashing.",
        "CI workflow fails merges when governance checks fail.",
        "Replay validator binds every run to the governance spec hash.",
      ],
    },
  };
}

export type {
  GovernanceCodegenEngine,
  GovernanceGeneratedArtifact,
  GenerateGovernanceArtifactsInput,
  GenerateGovernanceArtifactsOutput,
} from "./codegen-types";
export { CODEGEN_ENGINE as GOVERNANCE_CODEGEN_ENGINE };
