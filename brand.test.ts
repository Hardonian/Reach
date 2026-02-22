import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Brand Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to ReadyLayer when env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_BRAND_NAME;
    const { BRAND_NAME } = await import('./brand');
    expect(BRAND_NAME).toBe('ReadyLayer');
  });

  it('uses env var when set (Rollback Mode)', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', 'Reach');
    const { BRAND_NAME } = await import('./brand');
    expect(BRAND_NAME).toBe('Reach');
  });
});