import * as vscode from 'vscode';
import { BridgeClient } from './bridgeClient';
import { buildContextPayload, ContextSync } from './contextSync';
import { ReachPanel } from './panel';
import { runMarketplaceInstalled, runMarketplaceInstall, runMarketplaceSearch, runMarketplaceUpdate } from './marketplace';
import { MarketplaceClient } from './marketplaceClient';
import { BridgeEvent } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const panelRef: { current?: ReachPanel } = {};

  const bridgeClient = new BridgeClient({
    getUrl: () => vscode.workspace.getConfiguration('reach').get<string>('bridgeUrl', 'ws://localhost:8787'),
    onStatusChange: (connected) => {
      vscode.window.setStatusBarMessage(
        connected ? 'Reach bridge connected' : 'Reach bridge disconnected',
        4000
      );
    },
    onMessage: async (event) => {
      if (typeof event === 'object' && event !== null) {
        await panelRef.current?.handleBridgeEvent(event as BridgeEvent);
      }
    }
  });

  const panel = new ReachPanel(bridgeClient);
  panelRef.current = panel;

  const contextSync = new ContextSync(bridgeClient);

  const marketplaceClient = new MarketplaceClient(
    () => vscode.workspace.getConfiguration('reach').get<string>('connectorRegistryUrl', 'http://localhost:8092')
  );

  context.subscriptions.push(
    bridgeClient,
    panel,
    contextSync,
    vscode.commands.registerCommand('reach.start', () => {
      bridgeClient.forceReconnect();
      contextSync.push();
    }),
    vscode.commands.registerCommand('reach.openPanel', () => panel.open()),
    vscode.commands.registerCommand('reach.joinSession', async () => {
      const sessionId = await vscode.window.showInputBox({ prompt: 'Reach session id' });
      if (!sessionId) {
        return;
      }
      const memberId = await vscode.window.showInputBox({ prompt: 'Member id', value: 'vscode-user' });
      bridgeClient.send({ type: 'session.join', sessionId, memberId: memberId ?? 'vscode-user' });
      panel.open();
      await panel.handleBridgeEvent({ type: 'session.member', memberId: memberId ?? 'vscode-user' });
    }),
    vscode.commands.registerCommand('reach.sendSelection', () => {
      bridgeClient.send({ type: 'selection', payload: buildContextPayload() });
    }),
    vscode.commands.registerCommand('reach.listConnectors', async () => {
      const cfg = vscode.workspace.getConfiguration('reach');
      const url = cfg.get<string>('connectorRegistryUrl', 'http://localhost:8092');
      try {
        const response = await fetch(`${url}/v1/connectors`);
        if (!response.ok) {
          throw new Error(`connector registry returned ${response.status}`);
        }
        const body = (await response.json()) as { connectors?: Array<{ id: string; provider: string; pinned_version: string; verified: boolean }> };
        const connectors = body.connectors ?? [];
        if (connectors.length === 0) {
          void vscode.window.showInformationMessage('No connectors installed.');
          return;
        }
        const lines = connectors.map((c) => `${c.id} (${c.provider}) v${c.pinned_version} verified=${c.verified}`);
        void vscode.window.showQuickPick(lines, { title: 'Installed Reach Connectors' });
      } catch (error) {
        void vscode.window.showErrorMessage(`Failed to list connectors: ${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('reach.marketplaceSearch', async () => {
      try {
        await runMarketplaceSearch(marketplaceClient);
      } catch (error) {
        void vscode.window.showErrorMessage(`Marketplace search failed: ${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('reach.marketplaceInstall', async () => {
      try {
        await runMarketplaceInstall(marketplaceClient);
      } catch (error) {
        void vscode.window.showErrorMessage(`Marketplace install failed: ${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('reach.marketplaceListInstalled', async () => {
      try {
        await runMarketplaceInstalled(marketplaceClient);
      } catch (error) {
        void vscode.window.showErrorMessage(`Marketplace installed list failed: ${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('reach.marketplaceUpdateInstalled', async () => {
      try {
        await runMarketplaceUpdate(marketplaceClient);
      } catch (error) {
        void vscode.window.showErrorMessage(`Marketplace update failed: ${String(error)}`);
      }
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('reach.bridgeUrl')) {
        bridgeClient.forceReconnect();
      }
    })
  );

  bridgeClient.connect();
  contextSync.push();

  context.subscriptions.push(
    vscode.commands.registerCommand('reach.autonomousStop', () => {
      bridgeClient.send({ type: 'autonomous.stop' });
      vscode.window.setStatusBarMessage('Reach autonomous stop requested', 3000);
    })
  );

}

export function deactivate(): void {
  // No-op.
}
