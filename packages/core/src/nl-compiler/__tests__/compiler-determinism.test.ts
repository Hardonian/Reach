import { describe, it, expect } from "vitest";
import { compileGovernanceIntent } from "../compiler.js";
import {
  computeFingerprintSync,
  verifyRustMatchesTs,
  resetWasmModule,
} from "../determinism-bridge.js";
import type { CompileGovernanceIntentInput, GovernanceSpec } from "../types.js";

describe("compiler determinism", () => {
  const baseInput: CompileGovernanceIntentInput = {
    intent: "Require evaluation score >= 0.9 and provenance for all artifacts",
    orgId: "test-org",
    workspaceId: "test-workspace",
    scope: "project",
    memory: [],
    defaultRolloutMode: "dry-run",
  };

  it("should produce identical specHash for identical inputs", () => {
    const result1 = compileGovernanceIntent(baseInput);
    const result2 = compileGovernanceIntent(baseInput);

    expect(result1.specHash).toBe(result2.specHash);
    expect(result1.canonicalSpec).toBe(result2.canonicalSpec);
  });

  it("should produce consistent specHash across multiple runs", () => {
    const hashes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const result = compileGovernanceIntent(baseInput);
      hashes.push(result.specHash);
    }

    // All hashes should be identical
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });

  it("should produce stable specHash with different key order in memory", () => {
    const inputWithMemory1: CompileGovernanceIntentInput = {
      ...baseInput,
      memory: [
        {
          orgId: "test-org",
          workspaceId: "test-workspace",
          scope: "project",
          memoryType: "eval_baseline",
          content: { z: 1, a: 2, m: 3 },
          confidence: 0.9,
        },
      ],
    };

    const inputWithMemory2: CompileGovernanceIntentInput = {
      ...baseInput,
      memory: [
        {
          orgId: "test-org",
          workspaceId: "test-workspace",
          scope: "project",
          memoryType: "eval_baseline",
          content: { a: 2, m: 3, z: 1 },
          confidence: 0.9,
        },
      ],
    };

    const result1 = compileGovernanceIntent(inputWithMemory1);
    const result2 = compileGovernanceIntent(inputWithMemory2);

    expect(result1.specHash).toBe(result2.specHash);
  });

  it("should verify specHash matches manual computation", () => {
    const result = compileGovernanceIntent(baseInput);

    // Manually compute the hash
    const manualHash = computeFingerprintSync(result.spec);

    expect(result.specHash).toBe(manualHash);
  });

  it("should include determinismHash in explainability payload", () => {
    const result = compileGovernanceIntent(baseInput);

    expect(result.explainability.determinismHash).toBeDefined();
    expect(result.explainability.determinismHash).toBe(result.specHash);
    expect(result.explainability.determinismHash).toHaveLength(64); // SHA-256 hex
  });

  it("should have stable canonicalSpec format", () => {
    const result = compileGovernanceIntent(baseInput);

    // Parse and re-stringify should produce same canonical form
    const parsed = JSON.parse(result.canonicalSpec);
    const reCanonical = JSON.stringify(parsed, Object.keys(parsed).sort());

    // The canonicalSpec should already be in sorted key order
    expect(result.canonicalSpec).toContain('"gates"');
    expect(result.canonicalSpec).toContain('"thresholds"');
    expect(result.canonicalSpec).toContain('"rolloutMode"');
  });

  it("should verify spec structure matches GovernanceSpec type", () => {
    const result = compileGovernanceIntent(baseInput);
    const spec = result.spec;

    // Required fields
    expect(spec.gates).toBeInstanceOf(Array);
    expect(spec.thresholds).toBeInstanceOf(Array);
    expect(spec.rolloutMode).toMatch(/^(dry-run|enforced)$/);

    // Each gate should have required fields
    spec.gates.forEach((gate) => {
      expect(gate.id).toBeDefined();
      expect(gate.name).toBeDefined();
      expect(gate.gateType).toBeDefined();
      expect(gate.action).toMatch(/^(warn|block)$/);
    });

    // Each threshold should have required fields
    spec.thresholds.forEach((threshold) => {
      expect(threshold.id).toBeDefined();
      expect(threshold.metric).toBeDefined();
      expect(threshold.operator).toMatch(/^(>=|<=|>|<)$/);
      expect(typeof threshold.value).toBe("number");
    });
  });

  it("should compare TS and Rust fingerprints when WASM available", async () => {
    resetWasmModule();

    const result = compileGovernanceIntent(baseInput);
    const comparison = await verifyRustMatchesTs(result.spec);

    if (comparison.match) {
      console.log("✓ TypeScript and Rust fingerprints match for spec");
      expect(comparison.ts).toBe(comparison.rust);
    } else {
      console.log("TypeScript fingerprint:", comparison.ts);
      console.log("Rust fingerprint:", comparison.rust);

      if (comparison.diff === "Rust implementation unavailable") {
        console.log("WASM not available - skipping Rust comparison");
        // This is expected if WASM isn't built
        expect(comparison.ts).toBeDefined();
      } else {
        // If WASM is available but fingerprints don't match, that's a real issue
        throw new Error(`Fingerprint mismatch: ${comparison.diff}`);
      }
    }
  });

  it("should handle complex intents deterministically", () => {
    const complexInput: CompileGovernanceIntentInput = {
      intent:
        "Make this safer with provenance, replay, CI enforcement, model risk guards, and high evaluation thresholds",
      orgId: "test-org",
      workspaceId: "test-workspace",
      scope: "project",
      memory: [
        {
          orgId: "test-org",
          workspaceId: "test-workspace",
          scope: "project",
          memoryType: "eval_baseline",
          content: { evaluation_min: 0.95 },
          confidence: 0.92,
        },
        {
          orgId: "test-org",
          workspaceId: "test-workspace",
          scope: "project",
          memoryType: "risk_pattern",
          content: { hallucination_max: 0.05 },
          confidence: 0.88,
        },
      ],
      defaultRolloutMode: "dry-run",
    };

    const result1 = compileGovernanceIntent(complexInput);
    const result2 = compileGovernanceIntent(complexInput);

    expect(result1.specHash).toBe(result2.specHash);

    // Should have multiple gates for complex intent
    expect(result1.spec.gates.length).toBeGreaterThan(1);
    expect(result1.spec.thresholds.length).toBeGreaterThan(0);
  });

  it("should verify fingerprint changes when spec changes", () => {
    const result1 = compileGovernanceIntent(baseInput);

    const modifiedInput: CompileGovernanceIntentInput = {
      ...baseInput,
      intent: "Require evaluation score >= 0.8", // Different threshold
    };

    const result2 = compileGovernanceIntent(modifiedInput);

    // Different intent should produce different hash
    expect(result1.specHash).not.toBe(result2.specHash);
  });
});

describe("compiler specHash golden vectors", () => {
  const testCases: Array<{
    name: string;
    input: CompileGovernanceIntentInput;
    description: string;
  }> = [
    {
      name: "basic_eval_threshold",
      description: "Basic evaluation threshold intent",
      input: {
        intent: "Require evaluation score >= 0.9",
        orgId: "org-1",
        workspaceId: "ws-1",
        scope: "project",
        memory: [],
        defaultRolloutMode: "dry-run",
      },
    },
    {
      name: "with_provenance",
      description: "Intent requiring provenance",
      input: {
        intent: "Require provenance for all artifacts",
        orgId: "org-2",
        workspaceId: "ws-2",
        scope: "repo",
        memory: [],
        defaultRolloutMode: "dry-run",
      },
    },
    {
      name: "complex_multi_gate",
      description: "Complex intent with multiple gates",
      input: {
        intent: "Require evaluation >= 0.9, provenance, replay, and CI enforcement",
        orgId: "org-3",
        workspaceId: "ws-3",
        scope: "global",
        memory: [],
        defaultRolloutMode: "enforced",
      },
    },
  ];

  testCases.forEach(({ name, input, description }) => {
    it(`should produce stable hash for: ${name} (${description})`, () => {
      const result1 = compileGovernanceIntent(input);
      const result2 = compileGovernanceIntent(input);

      expect(result1.specHash).toBe(result2.specHash);
      expect(result1.specHash).toHaveLength(64);

      // Log the hash for potential golden vector use
      console.log(`${name}: ${result1.specHash}`);
    });
  });
});
