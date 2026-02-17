import * as vscode from 'vscode';
import { BridgeClient } from './bridgeClient';
import { buildContextPayload, ContextSync } from './contextSync';
import { ReachPanel } from './panel';

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
        await panelRef.current?.handleBridgeEvent(event as Record<string, unknown>);
      }
    }
  });

  const panel = new ReachPanel(bridgeClient);
  panelRef.current = panel;

  const contextSync = new ContextSync(bridgeClient);

  context.subscriptions.push(
    bridgeClient,
    panel,
    contextSync,
    vscode.commands.registerCommand('reach.start', () => {
      bridgeClient.forceReconnect();
      contextSync.push();
    }),
    vscode.commands.registerCommand('reach.openPanel', () => panel.open()),
    vscode.commands.registerCommand('reach.sendSelection', () => {
      bridgeClient.send({ type: 'selection', payload: buildContextPayload() });
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
