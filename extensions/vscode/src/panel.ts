import * as vscode from 'vscode';
import { BridgeClient } from './bridgeClient';
import { ApprovalPrompt, Artifact, BridgeEvent } from './types';
import { previewAndApplyDiff } from './diff';

export class ReachPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly events: BridgeEvent[] = [];
  private readonly artifacts: Artifact[] = [];
  private readonly approvals: ApprovalPrompt[] = [];
  private autonomousBanner = "";

  constructor(private readonly bridgeClient: BridgeClient) {}

  open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel('reachBridgePanel', 'Reach Bridge', vscode.ViewColumn.Beside, {
      enableScripts: true
    });

    this.panel.webview.html = this.render();
    this.panel.webview.onDidReceiveMessage((message: { type: string; [key: string]: unknown }) => {
      if (message.type === 'approvalDecision' && typeof message.promptId === 'string' && typeof message.decision === 'string') {
        this.bridgeClient.send({
          type: 'approvalDecision',
          promptId: message.promptId,
          decision: message.decision
        });
        const index = this.approvals.findIndex((prompt) => prompt.id === message.promptId);
        if (index >= 0) {
          this.approvals.splice(index, 1);
        }
        this.refresh();
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  async handleBridgeEvent(event: BridgeEvent): Promise<void> {
    this.events.unshift(event);
    if (this.events.length > 100) {
      this.events.length = 100;
    }

    if (event.type === 'artifact' && typeof event.name === 'string') {
      this.artifacts.unshift({
        name: event.name,
        description: typeof event.description === 'string' ? event.description : undefined,
        uri: typeof event.uri === 'string' ? event.uri : undefined
      });
      this.artifacts.length = Math.min(this.artifacts.length, 50);
    }

    if (event.type === 'approvalPrompt' && typeof event.id === 'string' && typeof event.title === 'string') {
      this.approvals.unshift({
        id: event.id,
        title: event.title,
        detail: typeof event.detail === 'string' ? event.detail : undefined
      });
      this.approvals.length = Math.min(this.approvals.length, 20);
    }

    if (event.type === "autonomous.started") {
      this.autonomousBanner = "Autonomous mode running";
    }
    if (event.type === "autonomous.stopped") {
      this.autonomousBanner = "Autonomous mode stopped";
    }

    if (event.type === 'patch' && typeof event.diff === 'string') {
      try {
        await previewAndApplyDiff(event.diff);
      } catch (error) {
        vscode.window.showErrorMessage(`Reach patch apply failed: ${(error as Error).message}`);
      }
    }

    this.refresh();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private refresh(): void {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage({
      type: 'state',
      events: this.events,
      artifacts: this.artifacts,
      approvals: this.approvals,
      autonomousBanner: this.autonomousBanner
    });
  }

  private render(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reach Bridge</title>
  <style>
    body { font-family: sans-serif; padding: 12px; }
    h2 { margin-top: 18px; }
    ul { padding-left: 18px; }
    .approval { border: 1px solid #ccc; border-radius: 6px; margin-bottom: 8px; padding: 8px; }
    .approval button { margin-right: 6px; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Reach IDE Bridge</h1>

  <div id="autonomous-banner" style="padding:6px;border:1px solid #4caf50;border-radius:6px;margin-bottom:8px;"></div>
  <h2>Streaming Events</h2>
  <ul id="events"></ul>

  <h2>Artifacts</h2>
  <ul id="artifacts"></ul>

  <h2>Approval Prompts</h2>
  <div id="approvals"></div>

  <script>
    const vscode = acquireVsCodeApi();

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type !== 'state') return;

      const banner = document.getElementById('autonomous-banner');
      banner.textContent = message.autonomousBanner || "";
      banner.style.display = banner.textContent ? "block" : "none";

      const eventsList = document.getElementById('events');
      eventsList.innerHTML = message.events
        .slice(0, 25)
        .map((entry) => '<li><code>' + escapeHtml(JSON.stringify(entry)) + '</code></li>')
        .join('');

      const artifactsList = document.getElementById('artifacts');
      artifactsList.innerHTML = message.artifacts
        .map((artifact) => artifact.uri
          ? '<li><a href="' + artifact.uri + '">' + escapeHtml(artifact.name) + '</a></li>'
          : '<li>' + escapeHtml(artifact.name) + '</li>')
        .join('');

      const approvalsContainer = document.getElementById('approvals');
      approvalsContainer.innerHTML = message.approvals
        .map((prompt) => '<div class="approval">'
          + '<strong>' + escapeHtml(prompt.title) + '</strong>'
          + '<p>' + escapeHtml(prompt.detail || '') + '</p>'
          + '<button data-id="' + prompt.id + '" data-decision="approve">Approve</button>'
          + '<button data-id="' + prompt.id + '" data-decision="reject">Reject</button>'
          + '</div>')
        .join('');

      approvalsContainer.querySelectorAll('button[data-id]').forEach((button) => {
        button.addEventListener('click', () => {
          vscode.postMessage({
            type: 'approvalDecision',
            promptId: button.getAttribute('data-id'),
            decision: button.getAttribute('data-decision')
          });
        });
      });
    });

    function escapeHtml(content) {
      return String(content)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
  </script>
</body>
</html>`;
  }
}
