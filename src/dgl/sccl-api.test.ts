import { describe, expect, it } from 'vitest';
import { authFailurePayload, paginate } from '../../apps/arcade/src/lib/sccl-api';

describe('sccl api helpers', () => {
  it('returns auth failure payload', () => {
    const payload = authFailurePayload();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('AUTH_REQUIRED');
  });

  it('paginates server-side rows deterministically', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const page2 = paginate(rows, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0]).toEqual({ id: 11 });
    expect(page2.totalPages).toBe(3);
  });
});
