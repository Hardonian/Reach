import * as vscode from 'vscode';
import { BridgeClient } from './bridgeClient';
import { ContextPayload } from './types';
import { createContextPayload } from './payload';

export function buildContextPayload(): ContextPayload {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const openFiles = vscode.workspace.textDocuments
    .filter((document) => !document.isUntitled)
    .map((document) => document.uri.fsPath);
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.selection;

  return createContextPayload({
    workspaceRoot: workspaceFolder?.uri.fsPath ?? null,
    openFiles,
    activeFile: editor?.document.uri.fsPath ?? null,
    selectionRange: selection
      ? {
          start: {
            line: selection.start.line,
            character: selection.start.character
          },
          end: {
            line: selection.end.line,
            character: selection.end.character
          }
        }
      : null
  });
}

export class ContextSync implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly bridgeClient: BridgeClient) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(() => this.push()),
      vscode.workspace.onDidChangeTextDocument(() => this.push()),
      vscode.window.onDidChangeTextEditorSelection(() => this.push())
    );
  }

  push(): void {
    const payload = buildContextPayload();
    this.bridgeClient.send({ type: 'context', payload });
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
