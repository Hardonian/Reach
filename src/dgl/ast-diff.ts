import ts from "typescript";
import type { DglViolation } from "./types.js";

interface ExportInfo {
  signatures: Map<string, { signature: string; line: number }>;
}

function exportedInfo(sourceText: string): ExportInfo {
  const source = ts.createSourceFile("file.ts", sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const signatures = new Map<string, { signature: string; line: number }>();

  const hasExportModifier = (node: ts.Node): boolean => {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  };

  source.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
      const name = node.name.text;
      const params = node.parameters.map((p) => p.name.getText(source)).join(",");
      const ret = node.type ? node.type.getText(source) : "unknown";
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      signatures.set(name, { signature: `fn(${params}):${ret}`, line });
      return;
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          const initializerKind = decl.initializer?.kind ?? ts.SyntaxKind.Unknown;
          const line = source.getLineAndCharacterOfPosition(decl.getStart(source)).line + 1;
          signatures.set(name, { signature: `var:${ts.SyntaxKind[initializerKind]}`, line });
        }
      }
      return;
    }

    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      const name = node.name.text;
      const members = node.members.length;
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      signatures.set(name, { signature: `interface:${members}`, line });
      return;
    }

    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      const name = node.name.text;
      const rhs = node.type.getText(source);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      signatures.set(name, { signature: `type:${rhs}`, line });
    }
  });

  return { signatures };
}

export function diffAstExports(filePath: string, baseText: string, headText: string): DglViolation[] {
  const base = exportedInfo(baseText);
  const head = exportedInfo(headText);
  const violations: DglViolation[] = [];

  for (const [name, oldSig] of base.signatures.entries()) {
    const next = head.signatures.get(name);
    if (!next) {
      violations.push({
        type: "semantic",
        severity: "error",
        paths: [filePath],
        evidence: `Export '${name}' removed (${oldSig.signature}).`,
        suggested_fix: "Restore the export or document and version the breaking surface.",
        line: oldSig.line,
      });
      continue;
    }
    if (next.signature !== oldSig.signature) {
      violations.push({
        type: "semantic",
        severity: "warn",
        paths: [filePath],
        evidence: `Export '${name}' signature changed: ${oldSig.signature} -> ${next.signature}.`,
        suggested_fix: "Verify downstream compatibility and update callers/contracts.",
        line: next.line,
      });
    }
  }

  return violations;
}
