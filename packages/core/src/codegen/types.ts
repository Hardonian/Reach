import type { CIEnforcementRule, GovernanceSpec } from "../nl-compiler/types.js";

export interface GovernanceGeneratedArtifact {
  artifactType: "gate-config" | "ci-workflow" | "policy-module" | "eval-adapter" | "replay-validator";
  path: string;
  content: string;
  hash: string;
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
