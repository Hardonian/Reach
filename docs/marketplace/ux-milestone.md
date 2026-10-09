# Reach Marketplace UX Milestone ## API endpoints

### `GET /v1/marketplace/catalog` Supports `q`, `kind`, `risk`, `tier`, `capability`, `tag`, `publisher`, `sort`, `page`, `page_size`, `verified`.

Sample response:

```json
{
  "items": [{ "kind": "connector", "id": "conn.github", "name": "Github" }],
  "total": 1,
  "page": 1,
  "page_size": 25
}
```

### `GET /v1/marketplace/items/{kind}/{id}` Returns full item detail including trust metadata and capability disclosure.

### `POST /v1/marketplace/install-intent` Request:

```json
{ "kind": "connector", "id": "conn.github", "version": "1.0.0" }
```

Response includes resolved version, manifest summary, permission summary, signature status, and tier gate.

### `POST /v1/marketplace/install` Request:

```json
{
  "kind": "connector",
  "id": "conn.github",
  "version": "1.0.0",
  "accepted_capabilities": ["filesystem:read"],
  "accepted_risk": true
}
```

Install is rejected unless explicit risk acceptance and capability acceptance are present.

## Mobile navigation map (Android and iOS parity) 1. Marketplace Home

2. Results List
3. Item Detail
4. Install Consent Sheet
5. Installed Tab

## Mobile screenshots (description) - Home: search, category chips, verified toggle, risk/tier filters.

- Results: virtualized cards with verified/risk/tier/install badges.
- Detail: capability + side effect disclosure, publisher trust, changelog.
- Consent sheet: non-skippable checkbox and explicit install action.
- Installed tab: pinned versions, manual update/remove/check updates.

## VS Code command list and interaction flow 1. `Reach: Marketplace Search` (`reach.marketplaceSearch`) opens input, loads catalog into QuickPick, then consent-confirmed install.

2. `Reach: Install Connector/Template/Policy` (`reach.marketplaceInstall`) prompts for kind/id, fetches install-intent, requires modal confirmation.
3. `Reach: List Installed` (`reach.marketplaceListInstalled`) displays installed pinned versions.
4. `Reach: Update Installed` (`reach.marketplaceUpdateInstalled`) requires explicit update confirmation.

## Catalog caching strategy and limits - Server-side catalog cache with ETag/If-None-Match and Last-Modified/If-Modified-Since when remote index supports validators.

- TTL defaults to 120 seconds and bounded catalog size at 5000 items.
- Marketplace page size capped at 100 entries.
- HTTPS-only remote index fetch with retries and bounded payload sizes.

## Safety guarantees - No auto-install: install endpoint requires explicit consent payload.

- No silent upgrades: update is explicit flow from client actions.
- Capability + side effect disclosures are returned in install-intent.
- Tier restrictions enforced on install.
- Signature and SHA verification enforced before lockfile pin write.
- Dev-mode unsigned behavior is surfaced in signature status.
