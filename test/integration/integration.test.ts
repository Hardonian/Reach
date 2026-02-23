import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseAgentsArgs, runAgentsCommand } from "../../src/cli/agents-cli.js";
import { dispatchMcpRequest, getMcpToolDefinitions, validateMcpToolDefinitions } from "../../src/cli/mcp-cli.js";
import { executeZeoliteOperation } from "../../src/core/zeolite-core.js";
import { parseTranscriptArgs, runTranscriptCommand } from "../../src/cli/transcript-cli.js";

async function withTempCwd<T>(fn: (cwd: string) => Promise<T> | T): Promise<T> {
  const prev = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "zeo-cli-int-"));
  process.chdir(dir);
  try {
    return await fn(dir);
  } finally {
    process.chdir(prev);
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("agents lifecycle integration", () => {
  it("adds, lists, inspects, and removes agent plugins", async () => {
    await withTempCwd(async (cwd) => {
      const sourceDir = join(cwd, "source-agent");
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(join(sourceDir, "zeo.agent.json"), JSON.stringify({
        id: "test-agent",
        version: "1.0.0",
        capabilities: ["extract"],
        requiredTools: ["submit_evidence"],
        requiredEnvVars: ["ZEO_LLM_API_KEY"],
        permissions: { fs: false, network: false },
      }, null, 2));

      expect(await runAgentsCommand(parseAgentsArgs(["add", "source-agent", "--accept"]))).toBe(0);
      expect(await runAgentsCommand(parseAgentsArgs(["list"]))).toBe(0);
      expect(await runAgentsCommand(parseAgentsArgs(["inspect", "test-agent"]))).toBe(0);

      const lock = JSON.parse(readFileSync(join(cwd, ".zeo/agents/test-agent/zeo.agent.lock.json"), "utf8")) as Record<string, unknown>;
      expect(lock.mode).toBe("proposal_only");
      expect((lock.sandbox as Record<string, boolean>).fs).toBe(false);

      expect(await runAgentsCommand(parseAgentsArgs(["remove", "test-agent"]))).toBe(0);
    });
  });
});

describe("mcp schema + parity integration", () => {
  it("validates MCP tool definitions", () => {
    const issues = validateMcpToolDefinitions(getMcpToolDefinitions());
    expect(issues).toEqual([]);
  });


  it("validates tools/list JSON schema structure", async () => {
    const toolsListRaw = await dispatchMcpRequest(JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/list",
      params: {},
    }));

    const parsed = JSON.parse(toolsListRaw ?? "{}") as { result?: { schemaVersion?: string; tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> } };
    expect(parsed.result?.schemaVersion).toBe("zeo.mcp.v1");
    expect(Array.isArray(parsed.result?.tools)).toBe(true);

    for (const tool of parsed.result?.tools ?? []) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      expect(typeof tool.inputSchema.properties).toBe("object");
    }
  });

  it("keeps CLI and MCP execution parity for compute_flip_distance", async () => {
    const loaded = executeZeoliteOperation("load_context", { example: "negotiation", depth: 2, seed: "parity" });
    const contextId = String(loaded.contextId);

    const expected = executeZeoliteOperation("compute_flip_distance", { contextId });

    const initialize = await dispatchMcpRequest(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    }));
    expect(initialize).not.toBeNull();

    const resultRaw = await dispatchMcpRequest(JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "compute_flip_distance",
        arguments: { contextId },
      },
    }));

    const result = JSON.parse(resultRaw ?? "{}") as { result?: { structuredContent?: unknown; isError?: boolean } };
    expect(result.result?.isError).toBe(false);
    expect(result.result?.structuredContent).toEqual(expected);
  });
});


describe("transcript CLI and MCP parity", () => {
  it("verifies and replays exported transcript", async () => {
    await withTempCwd(async (cwd) => {
      const loaded = executeZeoliteOperation("load_context", { example: "negotiation", depth: 2, seed: "tx" });
      const contextId = String(loaded.contextId);
      const exported = executeZeoliteOperation("export_transcript", { contextId }) as { transcript: unknown; transcriptHash: string };
      // Wrap transcript in an envelope with signatures so verify command succeeds
      const envelope = {
        version: "1.0.0",
        payload: exported.transcript,
        transcript_hash: exported.transcriptHash,
        metadata: { created_by: "test", created_at: "1970-01-01T00:00:00.000Z" },
        signatures: [{ algorithm: "ed25519", purpose: "zeo.transcript.signature.v1", signer_fingerprint: "test-fp", signature: "test-sig", signed_at: "1970-01-01T00:00:00.000Z" }],
      };
      const transcriptPath = join(cwd, "transcript.json");
      writeFileSync(transcriptPath, JSON.stringify(envelope, null, 2));

      expect(await runTranscriptCommand(parseTranscriptArgs(["transcript", "verify", transcriptPath]))).toBe(0);
    });
  });

  it("exposes transcript tools via MCP list", async () => {
    const toolsListRaw = await dispatchMcpRequest(JSON.stringify({
      jsonrpc: "2.0",
      id: 55,
      method: "tools/list",
      params: {},
    }));

    const parsed = JSON.parse(toolsListRaw ?? "{}") as { result?: { tools?: Array<{ name: string }> } };
    const names = new Set((parsed.result?.tools ?? []).map((tool) => tool.name));
    expect(names.has("export_transcript")).toBe(true);
    expect(names.has("verify_transcript")).toBe(true);
    expect(names.has("replay_transcript")).toBe(true);
  });
});
