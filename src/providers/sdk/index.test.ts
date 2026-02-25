import { describe, expect, it } from 'vitest';
import { ExampleDeterministicAdapter, ProviderAdapterRegistry } from './index.js';

describe('ProviderAdapterRegistry', () => {
  it('registers and resolves deterministic adapters', async () => {
    const registry = new ProviderAdapterRegistry();
    const adapter = new ExampleDeterministicAdapter();
    registry.register(adapter);

    expect(registry.list()).toEqual(['example-deterministic']);

    const resolved = registry.get('example-deterministic');
    const pack = await resolved.generatePatchPack({
      baseSha: 'base123',
      headSha: 'head123',
      diff: 'diff --git a/a.ts b/a.ts',
      changedPaths: ['b.ts', 'a.ts'],
      model: 'test-model',
      agentId: 'agent-1',
    });

    expect(pack.changed_paths).toEqual(['a.ts', 'b.ts']);
    expect(resolved.getTelemetry().status).toBe('ok');
    expect(resolved.getAocMetadata().actor).toContain('provider:');
  });
});
