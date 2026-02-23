export interface ParsedHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

export interface ParsedFilePatch {
  oldPath: string;
  newPath: string;
  hunks: ParsedHunk[];
}

export function parseUnifiedDiff(diffText: string): ParsedFilePatch[] {
  const lines = diffText.split(/\r?\n/);
  const patches: ParsedFilePatch[] = [];
  let current: ParsedFilePatch | null = null;
  let currentHunk: ParsedHunk | null = null;

  for (const line of lines) {
    if (line.startsWith("--- ")) {
      if (current) {
        patches.push(current);
      }
      current = {
        oldPath: normalizePath(line.slice(4)),
        newPath: "",
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("+++ ")) {
      current.newPath = normalizePath(line.slice(4));
      continue;
    }

    const hunkMatch = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunkMatch) {
      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldCount: Number(hunkMatch[2] ?? "1"),
        newStart: Number(hunkMatch[3]),
        newCount: Number(hunkMatch[4] ?? "1"),
        lines: [],
      };
      current.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk && /^[ +-]/.test(line)) {
      currentHunk.lines.push(line);
    }
  }

  if (current) {
    patches.push(current);
  }

  return patches.filter((patch) => patch.newPath && patch.hunks.length > 0);
}

export function applyPatchToText(originalText: string, patch: ParsedFilePatch): string {
  const originalLines = originalText.split("\n");
  const resultLines: string[] = [];
  let readIndex = 0;

  for (const hunk of patch.hunks) {
    const expectedStart = hunk.oldStart - 1;

    while (readIndex < expectedStart) {
      resultLines.push(originalLines[readIndex]);
      readIndex += 1;
    }

    for (const hunkLine of hunk.lines) {
      const operation = hunkLine[0];
      const content = hunkLine.slice(1);

      if (operation === " ") {
        if (originalLines[readIndex] !== content) {
          throw new Error(`Patch context mismatch for ${patch.newPath}`);
        }
        resultLines.push(originalLines[readIndex]);
        readIndex += 1;
      } else if (operation === "-") {
        if (originalLines[readIndex] !== content) {
          throw new Error(`Patch deletion mismatch for ${patch.newPath}`);
        }
        readIndex += 1;
      } else if (operation === "+") {
        resultLines.push(content);
      }
    }
  }

  while (readIndex < originalLines.length) {
    resultLines.push(originalLines[readIndex]);
    readIndex += 1;
  }

  return resultLines.join("\n");
}

function normalizePath(raw: string): string {
  return raw.replace(/^[ab]\//, "").trim();
}
