/**
 * test/harness/env.ts
 * Provides deterministic temp dirs, temp DB paths, and free port selection.
 * No Date.now() or Math.random() — all entropy is injected via parameters.
 */

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

export function createTempDir(prefix = "reach-system-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export interface TestEnv {
  tempDir: string;
  dbPath: string;
  port: number;
}

export async function createTestEnv(): Promise<TestEnv> {
  const tempDir = createTempDir();
  const dbPath = join(tempDir, "reach.db");
  const port = await getFreePort();
  return { tempDir, dbPath, port };
}

export function cleanupTestEnv(env: TestEnv): void {
  if (existsSync(env.tempDir)) {
    rmSync(env.tempDir, { recursive: true, force: true });
  }
}
