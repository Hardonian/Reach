import * as vscode from "vscode";
import { MarketplaceClient, MarketplaceItem } from "./marketplaceClient";

export async function runMarketplaceSearch(client: MarketplaceClient): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: "Search Reach Marketplace",
  });
  if (!query) {
    return;
  }
  const results = await client.search(query);
  const selected = await vscode.window.showQuickPick(
    results.map((item) => ({
      label: `${item.name} ${item.publisher.verified ? "✅" : "⚠️"}`,
      description: `${item.kind} • risk:${item.risk_level} • tier:${item.tier_required}`,
      detail: `${item.id} • latest ${item.latest_version}`,
      item,
    })),
    { title: "Reach Marketplace Search Results" },
  );
  if (!selected) {
    return;
  }
  await installFromItem(client, selected.item);
}

export async function runMarketplaceInstall(client: MarketplaceClient): Promise<void> {
  const kind = await vscode.window.showQuickPick(["connector", "template", "policy"], {
    title: "Install kind",
  });
  if (!kind) {
    return;
  }
  const id = await vscode.window.showInputBox({ prompt: `${kind} id` });
  if (!id) {
    return;
  }
  const intent = await client.installIntent(kind, id);
  const ok = await vscode.window.showWarningMessage(
    `Install ${id}@${intent.resolved_version}? Capabilities: ${(intent.permissions_summary?.required_capabilities ?? []).join(", ") || "none"}; Side effects: ${(intent.permissions_summary?.side_effect_types ?? []).join(", ") || "none"}`,
    { modal: true },
    "Install",
  );
  if (ok !== "Install") {
    return;
  }
  await client.install(
    kind,
    id,
    intent.resolved_version,
    intent.idempotency_key,
    intent.permissions_summary?.required_capabilities ?? [],
  );
  void vscode.window.showInformationMessage(`Installed ${id}@${intent.resolved_version}`);
}

async function installFromItem(client: MarketplaceClient, item: MarketplaceItem): Promise<void> {
  const intent = await client.installIntent(item.kind, item.id, item.latest_version);
  const confirm = await vscode.window.showWarningMessage(
    `Install ${item.name} (${item.id})? Capabilities: ${(item.required_capabilities ?? []).join(", ") || "none"}; side effects: ${(item.side_effect_types ?? []).join(", ") || "none"}`,
    { modal: true },
    "Install",
  );
  if (confirm !== "Install") {
    return;
  }
  await client.install(
    item.kind,
    item.id,
    intent.resolved_version,
    intent.idempotency_key,
    intent.permissions_summary?.required_capabilities ?? [],
  );
  void vscode.window.showInformationMessage(`Installed ${item.id}@${intent.resolved_version}`);
}

export async function runMarketplaceInstalled(client: MarketplaceClient): Promise<void> {
  const items = await client.installed();
  if (items.length === 0) {
    void vscode.window.showInformationMessage("No installed marketplace items.");
    return;
  }
  await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.id,
      description: `Installed ${item.pinned_version}`,
    })),
    { title: "Installed Reach Marketplace Items" },
  );
}

export async function runMarketplaceUpdate(client: MarketplaceClient): Promise<void> {
  const items = await client.installed();
  if (items.length === 0) {
    void vscode.window.showInformationMessage("No installed items to update.");
    return;
  }
  const target = await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.id,
      description: `Current ${item.pinned_version}`,
      item,
    })),
    { title: "Select item to update" },
  );
  if (!target) {
    return;
  }
  const intent = await client.installIntent("connector", target.item.id);
  const confirm = await vscode.window.showWarningMessage(
    `Update ${target.item.id} from ${target.item.pinned_version} to ${intent.resolved_version}?`,
    { modal: true },
    "Update",
  );
  if (confirm !== "Update") {
    return;
  }
  await client.update(
    "connector",
    target.item.id,
    intent.resolved_version,
    intent.idempotency_key,
    intent.permissions_summary?.required_capabilities ?? [],
  );
  void vscode.window.showInformationMessage(
    `Updated ${target.item.id} to ${intent.resolved_version}`,
  );
}
