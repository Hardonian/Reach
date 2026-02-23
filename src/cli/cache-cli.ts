// @ts-nocheck
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

export interface CacheCliArgs {
  command: "list" | "prune" | "gc" | null;
  maxMb: number;
}

export function parseCacheArgs(argv: string[]): CacheCliArgs {
  const command =
    argv[0] === "list" || argv[0] === "prune" || argv[0] === "gc"
      ? argv[0]
      : null;
  let maxMb = 100;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max-mb" && argv[i + 1])
      maxMb = Math.max(1, Number.parseInt(argv[i + 1], 10));
  }
  return { command, maxMb };
}

function cacheDir(): string {
  const dir = resolve(process.cwd(), ".zeo-cache");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function totalSize(paths: string[]): number {
  return paths.reduce((sum, p) => sum + statSync(p).size, 0);
}

export async function runCacheCommand(args: CacheCliArgs): Promise<number> {
  if (!args.command) {
    console.log("Usage: zeo cache <list|prune|gc --max-mb N>");
    return 1;
  }

  const dir = cacheDir();
  const files = walkFiles(dir);
  if (args.command === "list") {
    console.log(
      JSON.stringify(
        {
          dir,
          entries: files.length,
          totalBytes: totalSize(files),
          createdAt: new Date().toISOString(),
          schemaVersion: "zeo.cache.v1",
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "prune") {
    let removed = 0;
    for (const f of files) {
      const age = Date.now() - statSync(f).mtimeMs;
      if (age > 7 * 24 * 3600 * 1000) {
        rmSync(f, { force: true });
        removed += 1;
      }
    }
    console.log(`pruned ${removed} entries`);
    return 0;
  }

  const budget = args.maxMb * 1024 * 1024;
  const sorted = files
    .map((f) => ({ f, st: statSync(f) }))
    .sort((a, b) => a.st.mtimeMs - b.st.mtimeMs);
  let size = totalSize(files);
  let removed = 0;
  for (const item of sorted) {
    if (size <= budget) break;
    rmSync(item.f, { force: true });
    size -= item.st.size;
    removed += 1;
  }
  console.log(`gc removed ${removed} entries, size=${size}`);
  return 0;
}
