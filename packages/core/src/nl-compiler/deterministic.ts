import crypto from "node:crypto";

function compareCodepoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(record).sort(compareCodepoints)) {
    sorted[key] = stableSortObject(record[key]);
  }

  return sorted;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortObject(value));
}

export function stableStringifyPretty(value: unknown): string {
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function compareNumbers(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareStrings(a: string, b: string): number {
  return compareCodepoints(a, b);
}
