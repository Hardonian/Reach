import * as vscode from 'vscode';

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { 'x-reach-auth': 'vscode' } });
  return response.json();
}

export function activate(context: vscode.ExtensionContext) {
  const cfg = () => vscode.workspace.getConfiguration('reach').get<string>('baseUrl', 'http://localhost:3000');

  context.subscriptions.push(vscode.commands.registerCommand('reach.syncStatus', async () => {
    const data = await getJson(`${cfg()}/api/sccl/status`);
    void vscode.window.showInformationMessage(`Reach SCCL status loaded: ${JSON.stringify(data).slice(0, 120)}...`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('reach.createBranch', async () => {
    await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', { text: 'reach sync branch --task "ide-task"\n' });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('reach.packPatch', async () => {
    void vscode.window.showInformationMessage('Create patch packs via reach sync apply --pack <patchpack>.');
  }));
}

export function deactivate() {
  return undefined;
}
