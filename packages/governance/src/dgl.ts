import type { GovernanceSpec } from "./types.js";

/**
 * DGL (Deterministic Governance Layer)
 * Ensures that governance decisions are reproducible and bit-identical.
 */
export interface DGL {
  readonly version: string;
  readonly hashAlgorithm: "sha256-cjson-v1";

  /**
   * Computes a stable hash for a governance spec.
   */
  computeSpecHash(spec: GovernanceSpec): string;

  /**
   * Verifies that a spec matches its canonical hash.
   */
  verifySpecIntegrity(spec: GovernanceSpec, expectedHash: string): boolean;
}
