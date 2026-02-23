export type MarketplaceItem = {
  kind: "connector" | "template" | "policy";
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
type InstalledItem = { id: string; pinned_version: string; kind: string };

export type InstallIntentResponse = {
  kind: string;
  id: string;
  resolved_version: string;
  idempotency_key: string;
  permissions_summary: {
    required_capabilities: string[];
    side_effect_types: string[];
    risk_level: string;
  };
  tier: {
    required: string;
    allowed: boolean;
    current: string;
  };
};

export class MarketplaceClient {
  constructor(private readonly getBaseUrl: () => string) {}

  async search(query: string): Promise<MarketplaceItem[]> {
    const base = this.getBaseUrl();
    const response = await fetch(
      `${base}/v1/marketplace/catalog?q=${encodeURIComponent(query)}&page=1&page_size=20`,
    );
    if (!response.ok) {
      throw new Error(`marketplace catalog request failed with ${response.status}`);
    }
    const body = (await response.json()) as CatalogResponse;
    return body.items ?? [];
  }

  async installIntent(kind: string, id: string, version?: string): Promise<InstallIntentResponse> {
    const base = this.getBaseUrl();
    const response = await fetch(`${base}/v1/marketplace/install-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, version }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`install-intent failed: ${err}`);
    }
    return (await response.json()) as InstallIntentResponse;
  }

  async install(
    kind: string,
    id: string,
    version: string,
    idempotencyKey: string,
    acceptedCapabilities: string[],
  ): Promise<void> {
    const base = this.getBaseUrl();
    const result = await fetch(`${base}/v1/marketplace/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        id,
        version,
        idempotency_key: idempotencyKey,
        accepted_capabilities: acceptedCapabilities,
        accepted_risk: true,
      }),
    });
    if (!result.ok) {
      throw new Error(`install failed: ${await result.text()}`);
    }
  }

  async update(
    kind: string,
    id: string,
    version: string,
    idempotencyKey: string,
    acceptedCapabilities: string[],
  ): Promise<void> {
    const base = this.getBaseUrl();
    const result = await fetch(`${base}/v1/marketplace/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        id,
        version,
        idempotency_key: idempotencyKey,
        accepted_capabilities: acceptedCapabilities,
        accepted_risk: true,
      }),
    });
    if (!result.ok) {
      throw new Error(`update failed: ${await result.text()}`);
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
