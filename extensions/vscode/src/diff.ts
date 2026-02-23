import * as vscode from "vscode";
import { applyPatchToText, parseUnifiedDiff } from "./diffCore";

export { applyPatchToText, parseUnifiedDiff } from "./diffCore";

export async function previewAndApplyDiff(diffText: string): Promise<void> {
  const patches = parseUnifiedDiff(diffText);
  if (patches.length === 0) {
    throw new Error("No valid file patches found in diff payload.");
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace to apply patches.");
  }

  const edit = new vscode.WorkspaceEdit();

  for (const patch of patches) {
    const relativePath = patch.newPath === "/dev/null" ? patch.oldPath : patch.newPath;
    const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
    const originalDocument = await vscode.workspace.openTextDocument(targetUri);
    const patchedText = applyPatchToText(originalDocument.getText(), patch);

    const previewDocument = await vscode.workspace.openTextDocument({
      language: originalDocument.languageId,
      content: patchedText,
    });

    await vscode.commands.executeCommand(
      "vscode.diff",
      originalDocument.uri,
      previewDocument.uri,
      `Reach Patch Preview: ${relativePath}`,
    );

    const replaceRange = new vscode.Range(
      originalDocument.positionAt(0),
      originalDocument.positionAt(originalDocument.getText().length),
    );

    edit.replace(originalDocument.uri, replaceRange, patchedText);
  }

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    throw new Error("VS Code rejected the workspace edit.");
  }
}
