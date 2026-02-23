import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "reach-system-test-"));
}

export function getFreePort(): number {
  const net = require("node:net");
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port;
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
  const fs = require("node:fs");
  if (fs.existsSync(env.tempDir)) {
    fs.rmSync(env.tempDir, { recursive: true, force: true });
  }
}
