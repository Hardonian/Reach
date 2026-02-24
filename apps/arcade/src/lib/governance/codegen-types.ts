import type { CIEnforcementRule, GovernanceSpec } from "./types";

export interface GovernanceCodegenEngine {
  name: string;
  version: string;
}

export interface GovernanceGeneratedArtifact {
  artifactType:
    | "gate-config"
    | "ci-workflow"
    | "policy-module"
    | "eval-adapter"
    | "replay-validator";
  path: string;
  content: string;
  hash: string;
  outputHash: string;
  engine: GovernanceCodegenEngine;
}

export interface GenerateGovernanceArtifactsInput {
  intent: string;
  spec: GovernanceSpec;
  specHash: string;
  ciEnforcement: CIEnforcementRule[];
}

export interface GenerateGovernanceArtifactsOutput {
  artifacts: GovernanceGeneratedArtifact[];
  explainability: {
    sourceIntent: string;
    generatedSpec: GovernanceSpec;
    determinismHash: string;
    riskImpactSummary: string[];
  };
}
