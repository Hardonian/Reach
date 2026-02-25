import { describe, expect, it } from 'vitest';
import { buildMergePlan } from './cpx-resolve.js';

describe('buildMergePlan', () => {
  it('builds deterministic packets and guarded steps', () => {
    const plan = buildMergePlan({
      run_id: 'cpx-run-1',
      per_patch: [
        { pack_id: 'b-pack', score_total: 0.4 },
        { pack_id: 'a-pack', score_total: 0.2 },
      ],
      conflict_matrix: {
        'a-pack': { 'b-pack': { reasons: ['semantic disagreement'], text_conflict: 0.2, semantic_conflict: 0.8, boundary_conflict: 0.1 } },
        'b-pack': { 'a-pack': { reasons: ['semantic disagreement'], text_conflict: 0.2, semantic_conflict: 0.8, boundary_conflict: 0.1 } },
      },
    }, '1970-01-01T00:00:00.000Z');

    expect(plan.packets[0]?.severity).toBe('high');
    expect(plan.steps[0]?.target_pack_id).toBe('a-pack');
    expect(plan.unsafe_auto_merge).toBe(false);
  });
});
