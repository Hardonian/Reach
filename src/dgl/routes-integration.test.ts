import { describe, expect, it } from 'vitest';
import { listRuns, listViolations, listTurbulence } from '../../apps/arcade/src/lib/dgl-runs-api';

describe('route integration helpers', () => {
  const records = [
    { run_id: 'a', timestamp: '2026-02-22T00:00:00Z', repo: 'Reach', base_sha: 'main', head_sha: 'feat', provider: { provider: 'openai' }, violations: [{ severity: 'error', type: 'openapi', paths: ['a.ts'] }, { severity: 'warn', type: 'semantic', paths: ['b.ts'] }], turbulence_hotspots: [{ path: 'src/a.ts' }] },
    { run_id: 'b', timestamp: '2026-02-21T00:00:00Z', repo: 'Reach', base_sha: 'main', head_sha: 'fix', provider: { provider: 'anthropic' }, violations: [], turbulence_hotspots: [] },
  ];

  it('paginates and filters runs', () => {
    const out = listRuns(records as any, { page: 1, limit: 1, provider: 'openai' });
    expect(out.total).toBe(1);
    expect(out.rows[0].run_id).toBe('a');
  });

  it('paginates violations with stable ordering', () => {
    const out = listViolations(records[0] as any, { page: 1, limit: 10, severity: 'error' });
    expect(out.total).toBe(1);
    expect((out.rows[0] as any).type).toBe('openapi');
  });

  it('filters turbulence by prefix', () => {
    const out = listTurbulence(records[0] as any, { pathPrefix: 'src/' });
    expect(out.total).toBe(1);
  });
});
