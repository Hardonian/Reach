import { compareStrings, sha256Hex, stableStringifyPretty } from "../nl-compiler/deterministic.js";
import type {
  GenerateGovernanceArtifactsInput,
  GenerateGovernanceArtifactsOutput,
  GovernanceGeneratedArtifact,
} from "./types.js";

function makeGateConfigArtifact(
  input: GenerateGovernanceArtifactsInput,
): GovernanceGeneratedArtifact {
  const content = stableStringifyPretty({
    version: "reach.governance.gate.v1",
    sourceIntent: input.intent,
    determinismHash: input.specHash,
    generatedSpec: input.spec,
  });

  return {
    artifactType: "gate-config",
    path: "governance/reach.governance.json",
    content,
    hash: sha256Hex(content),
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

  return {
    artifactType: "replay-validator",
    path: "governance/replay.validator.json",
    content,
    hash: sha256Hex(content),
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

  return {
    artifactType: "policy-module",
    path: "governance/policy.rego",
    content,
    hash: sha256Hex(content),
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

  return {
    artifactType: "eval-adapter",
    path: "governance/eval.adapter.json",
    content,
    hash: sha256Hex(content),
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

  return {
    artifactType: "ci-workflow",
    path: ".github/workflows/reach-gates.yml",
    content,
    hash: sha256Hex(content),
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
