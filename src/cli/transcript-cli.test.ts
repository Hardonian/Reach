// @ts-nocheck
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runTranscriptCommand } from "./transcript-cli.js";

describe("transcript cli", () => {
  it("sign -> verify -> trust record flow", async () => {
    const root = mkdtempSync(join(tmpdir(), "zeo-cli-transcript-"));
    const old = process.cwd();
    process.chdir(root);
    try {
      const transcriptPath = join(root, "t.json");
      const keyPath = join(root, ".zeo", "keys", "id.pem");
      const pubPath = join(root, "id.pub");
      const envPath = join(root, "e.json");
      writeFileSync(transcriptPath, JSON.stringify({ decision: "go" }));

      expect(await runTranscriptCommand(["keygen", "--out", keyPath])).toBe(0);
      expect(
        await runTranscriptCommand(["key", "export", "--key", keyPath]),
      ).toBe(0);
      const pub = await (
        await import("@zeo/core")
      ).exportPublicKeyFromPrivate(keyPath);
      writeFileSync(pubPath, pub);
      expect(await runTranscriptCommand(["keys", "add", pubPath])).toBe(0);
      expect(
        await runTranscriptCommand([
          "transcript",
          "sign",
          transcriptPath,
          "--key",
          keyPath,
          "--out",
          envPath,
        ]),
      ).toBe(0);
      expect(
        await runTranscriptCommand(["transcript", "verify", envPath]),
      ).toBe(0);
      expect(
        await runTranscriptCommand(["trust", "record", "--from", envPath]),
      ).toBe(0);
      expect(await runTranscriptCommand(["trust", "list"])).toBe(0);
    } finally {
      process.chdir(old);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
