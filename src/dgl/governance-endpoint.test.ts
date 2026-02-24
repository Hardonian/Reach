import { describe, expect, it } from 'vitest';
import { authFailurePayload, buildDglPayload } from '../../apps/arcade/src/lib/dgl-governance-api';

describe('/api/governance/dgl endpoint behavior', () => {
  it('returns auth-failure payload shape', () => {
    const payload = authFailurePayload();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('AUTH_REQUIRED');
  });

  it('applies provider, branch, and subsystem filters', () => {
    const report = {
      branch: 'feature/dgl',
      violations: [
        { type: 'semantic', paths: ['src/a.ts'], evidence: 'security boundary changed' },
        { type: 'api_contract', paths: ['src/b.ts'], evidence: 'ui copy changed' },
      ],
      turbulence_hotspots: [{ path: 'src/a.ts', reason: 'reverts', count: 3 }],
    };

    const matrix = [
      { provider: 'local', model: 'gpt', pass_rate: 1 },
      { provider: 'openrouter', model: 'gemini', pass_rate: 0.8 },
    ];

    const filtered = buildDglPayload(report, matrix, { provider: 'local', branch: 'feature', subsystem: 'security' });
    expect(filtered.provider_matrix).toHaveLength(1);
    expect(filtered.violations).toHaveLength(1);

    const branchMiss = buildDglPayload(report, matrix, { branch: 'main' });
    expect(branchMiss.report).toBeNull();
    expect(branchMiss.violations).toHaveLength(0);
  });
});
