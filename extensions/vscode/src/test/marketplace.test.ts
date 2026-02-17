import { describe, expect, it, vi } from 'vitest';
import { MarketplaceClient } from '../marketplaceClient';

describe('MarketplaceClient', () => {
  it('search populates results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [{ id: 'conn.github', name: 'GitHub', kind: 'connector', publisher: { name: 'Reach', verified: true }, risk_level: 'low', tier_required: 'free', latest_version: '1.0.0', required_capabilities: [], side_effect_types: [] }] })
    })));
    const client = new MarketplaceClient(() => 'http://localhost:8092');
    const results = await client.search('github');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('conn.github');
  });

  it('install posts explicit consent payload', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new MarketplaceClient(() => 'http://localhost:8092');
    await client.install('connector', 'conn.github', '1.0.0', ['filesystem:read']);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8092/v1/marketplace/install', expect.objectContaining({ method: 'POST' }));
  });
});
