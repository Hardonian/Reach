import { describe, it, expect } from 'vitest';
import {
  compileGovernanceIntentAsync,
  compileGovernanceIntentWasm,
  getCompilerMetadata,
} from '../compiler-async.js';
import { compileGovernanceIntent } from '../compiler.js';
import { isWasmAvailable, resetWasmModule } from '../determinism-bridge.js';
import type { CompileGovernanceIntentInput } from '../types.js';

describe('compiler-async', () => {
  const baseInput: CompileGovernanceIntentInput = {
    intent: "Require evaluation score >= 0.9 and provenance for all artifacts",
    orgId: "test-org",
    workspaceId: "test-workspace",
    scope: "project",
    memory: [],
    defaultRolloutMode: "dry-run",
  };

  it('should compile with async API', async () => {
    const result = await compileGovernanceIntentAsync(baseInput);

    expect(result.specHash).toBeDefined();
    expect(result.canonicalSpec).toBeDefined();
    expect(result.spec.gates).toBeInstanceOf(Array);
    expect(result.spec.thresholds).toBeInstanceOf(Array);
  });

  it('should produce same output as sync compiler', async () => {
    const syncResult = compileGovernanceIntent(baseInput);
    const asyncResult = await compileGovernanceIntentAsync(baseInput, { preferWasm: false });

    expect(asyncResult.specHash).toBe(syncResult.specHash);
    expect(asyncResult.canonicalSpec).toBe(syncResult.canonicalSpec);
    expect(asyncResult.spec).toEqual(syncResult.spec);
  });

  it('should handle WASM unavailability gracefully', async () => {
    resetWasmModule();
    
    // Should not throw even if WASM is unavailable
    const result = await compileGovernanceIntentAsync(baseInput, { preferWasm: true });
    
    expect(result.specHash).toBeDefined();
    expect(result.specHash).toHaveLength(64);
  });

  it('should throw when WASM is required but unavailable', async () => {
    resetWasmModule();
    
    const wasmAvailable = await isWasmAvailable();
    
    if (!wasmAvailable) {
      await expect(compileGovernanceIntentWasm(baseInput)).rejects.toThrow('WASM implementation required');
    }
  });

  it('should include WASM status in explainability when available', async () => {
    resetWasmModule();
    
    const result = await compileGovernanceIntentAsync(baseInput, { preferWasm: true });
    
    // Should mention WASM or TypeScript in the risk impact summary
    const hasImplementationNote = result.explainability.riskImpactSummary.some(
      note => note.includes('WASM') || note.includes('TypeScript')
    );
    
    expect(hasImplementationNote).toBe(true);
  });

  it('should provide compiler metadata', async () => {
    const metadata = await getCompilerMetadata();
    
    expect(typeof metadata.wasmAvailable).toBe('boolean');
    expect(typeof metadata.tsVersion).toBe('string');
    
    if (metadata.wasmAvailable) {
      expect(metadata.wasmVersion).toBeDefined();
    }
  });

  it('should compile complex intents asynchronously', async () => {
    const complexInput: CompileGovernanceIntentInput = {
      intent: "Require high evaluation scores, provenance, replay, CI enforcement, and model risk guards",
      orgId: "test-org",
      workspaceId: "test-workspace",
      scope: "global",
      memory: [
        {
          orgId: "test-org",
          workspaceId: "test-workspace",
          scope: "global",
          memoryType: "eval_baseline",
          content: { evaluation_min: 0.95 },
          confidence: 0.92,
        },
      ],
      defaultRolloutMode: "enforced",
    };

    const result = await compileGovernanceIntentAsync(complexInput);

    expect(result.spec.gates.length).toBeGreaterThan(1);
    expect(result.spec.rolloutMode).toBe("enforced");
    expect(result.specHash).toHaveLength(64);
  });

  it('should maintain determinism across async calls', async () => {
    const results = await Promise.all([
      compileGovernanceIntentAsync(baseInput),
      compileGovernanceIntentAsync(baseInput),
      compileGovernanceIntentAsync(baseInput),
    ]);

    const hashes = results.map(r => r.specHash);
    const uniqueHashes = new Set(hashes);
    
    expect(uniqueHashes.size).toBe(1);
  });

  it('should handle errors gracefully', async () => {
    // Test with invalid input that might cause issues
    const invalidInput = {
      ...baseInput,
      intent: "", // Empty intent
    };

    // Should still produce a result (compiler handles empty intent)
    const result = await compileGovernanceIntentAsync(invalidInput);
    expect(result.specHash).toBeDefined();
  });
});

describe('compiler-async with WASM', () => {
  const wasmTestInput: CompileGovernanceIntentInput = {
    intent: "Require evaluation score >= 0.9",
    orgId: "test-org",
    workspaceId: "test-workspace",
    scope: "project",
    memory: [],
    defaultRolloutMode: "dry-run",
  };

  it('should use WASM when available and preferred', async () => {
    resetWasmModule();
    
    const wasmAvailable = await isWasmAvailable();
    
    const result = await compileGovernanceIntentAsync(wasmTestInput, { 
      preferWasm: true,
      requireWasm: false 
    });
    
    expect(result.specHash).toBeDefined();
    
    if (wasmAvailable) {
      // Should indicate WASM was used
      const wasmNote = result.explainability.riskImpactSummary.find(
        note => note.includes('WASM acceleration enabled')
      );
      expect(wasmNote).toBeDefined();
    }
  });
});
