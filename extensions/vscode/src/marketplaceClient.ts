export type MarketplaceItem = {
  kind: 'connector' | 'template' | 'policy';
  id: string;
  name: string;
  publisher: { name: string; verified: boolean };
  risk_level: string;
  tier_required: string;
  latest_version: string;
  required_capabilities: string[];
  side_effect_types: string[];
};

type CatalogResponse = { items: MarketplaceItem[] };
type InstalledItem = { id: string; pinned_version: string };

export class MarketplaceClient {
  constructor(private readonly getBaseUrl: () => string) {}

  async search(query: string): Promise<MarketplaceItem[]> {
    const base = this.getBaseUrl();
    const response = await fetch(`${base}/v1/marketplace/catalog?q=${encodeURIComponent(query)}&page=1&page_size=20`);
    if (!response.ok) {
      throw new Error(`marketplace catalog request failed with ${response.status}`);
    }
    const body = (await response.json()) as CatalogResponse;
    return body.items ?? [];
  }

  async installIntent(kind: string, id: string, version?: string): Promise<any> {
    const base = this.getBaseUrl();
    const response = await fetch(`${base}/v1/marketplace/install-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, version })
    });
    if (!response.ok) {
      throw new Error(`install-intent request failed with ${response.status}`);
    }
    return response.json();
  }

  async install(kind: string, id: string, version: string, acceptedCapabilities: string[]): Promise<void> {
    const base = this.getBaseUrl();
    const response = await fetch(`${base}/v1/marketplace/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        id,
        version,
        accepted_capabilities: acceptedCapabilities,
        accepted_risk: true
      })
    });
    if (!response.ok) {
      throw new Error(`install request failed with ${response.status}`);
    }
  }

  async installed(): Promise<InstalledItem[]> {
    const base = this.getBaseUrl();
    const response = await fetch(`${base}/v1/connectors`);
    if (!response.ok) {
      throw new Error(`installed request failed with ${response.status}`);
    }
    const body = (await response.json()) as { installed?: InstalledItem[] };
    return body.installed ?? [];
  }
}
