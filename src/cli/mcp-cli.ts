// @ts-nocheck
import { createInterface } from "node:readline";
import type { ZeoliteOperation } from "../core/zeolite-core.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCliArgs {
  command: "serve" | "ping" | "tools" | "test" | null;
  http: boolean;
  json: boolean;
}

export function parseMcpArgs(argv: string[]): McpCliArgs {
  const raw = argv[0];
  const command = raw === "serve" || raw === "ping" || raw === "tools" || raw === "test" ? raw : null;
  return { command, http: argv.includes("--http"), json: argv.includes("--json") };
}

const SCHEMA_VERSION = "zeo.mcp.v1";

const TOOL_DEFS: McpToolDef[] = [
  {
    name: "export_transcript",
    description: "Export deterministic decision transcript for a context.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" } }, required: ["contextId"] },
  },
  {
    name: "verify_transcript",
    description: "Verify transcript hash and invariants.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, transcriptId: { type: "string" } }, required: ["contextId", "transcriptId"] },
  },
  {
    name: "replay_transcript",
    description: "Replay transcript and assert deterministic agreement.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, transcriptId: { type: "string" } }, required: ["contextId", "transcriptId"] },
  },
  {
    name: "submit_evidence",
    description: "Submit evidence to an active Zeolite context.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, sourceId: { type: "string" }, claim: { type: "string" }, capturedAt: { type: "string" } }, required: ["contextId", "sourceId", "claim"] },
  },
  {
    name: "compute_flip_distance",
    description: "Compute deterministic flip-distance approximations.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" } }, required: ["contextId"] },
  },
  {
    name: "rank_evidence_by_voi",
    description: "Rank evidence actions by VOI.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, minEvoi: { type: "number" } }, required: ["contextId"] },
  },
  {
    name: "generate_regret_bounded_plan",
    description: "Generate bounded-horizon regret-aware evidence plan.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, horizon: { type: "number" }, minEvoi: { type: "number" } }, required: ["contextId"] },
  },
  {
    name: "explain_decision_boundary",
    description: "Return decision boundary and sensitivity deltas.",
    inputSchema: { type: "object", properties: { contextId: { type: "string" }, agentClaim: {} }, required: ["contextId"] },
  },
];

export function getMcpToolDefinitions(): McpToolDef[] {
  return TOOL_DEFS;
}

export function validateMcpToolDefinitions(definitions: McpToolDef[] = TOOL_DEFS): string[] {
  const requiredNames = [
    "submit_evidence",
    "compute_flip_distance",
    "rank_evidence_by_voi",
    "generate_regret_bounded_plan",
    "explain_decision_boundary",
    "export_transcript",
    "verify_transcript",
    "replay_transcript",
  ];

  const issues: string[] = [];
  const names = definitions.map((d) => d.name);
  if (names.length !== requiredNames.length) issues.push(`expected ${requiredNames.length} tools, got ${names.length}`);
  for (const name of requiredNames) {
    if (!names.includes(name)) issues.push(`missing required deterministic tool '${name}'`);
  }

  for (const def of definitions) {
    if (!def.name || !def.description) issues.push(`tool definition must include name/description (${def.name || "unknown"})`);
    if (def.inputSchema.type !== "object") issues.push(`tool '${def.name}' inputSchema.type must be object`);
    if (!Array.isArray(def.inputSchema.required)) issues.push(`tool '${def.name}' inputSchema.required must be an array`);
  }

  return issues;
}

function help(): void {
  console.log("\nZeo MCP Commands\n\nUsage:\n  zeo mcp serve\n  zeo mcp ping\n  zeo mcp tools\n  zeo mcp test [--json]    Run handshake smoke test\n");
}

function response(id: JsonRpcId, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function error(id: JsonRpcId, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}


async function executeToolOperation(name: ZeoliteOperation, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { executeZeoliteOperation } = await import("../core/zeolite-core.js");
  return executeZeoliteOperation(name, args);
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const knownOperations = new Set<ZeoliteOperation>([
    "submit_evidence",
    "compute_flip_distance",
    "rank_evidence_by_voi",
    "generate_regret_bounded_plan",
    "explain_decision_boundary",
    "export_transcript",
    "verify_transcript",
    "replay_transcript",
  ]);

  if (!knownOperations.has(name as ZeoliteOperation)) {
    return { schemaVersion: SCHEMA_VERSION, isError: true, error: { code: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` } };
  }

  try {
    const structuredContent = await executeToolOperation(name as ZeoliteOperation, args);
    return { schemaVersion: SCHEMA_VERSION, isError: false, structuredContent };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return { schemaVersion: SCHEMA_VERSION, isError: true, error: { code: "TOOL_EXECUTION_FAILED", message } };
  }
}

export async function dispatchMcpRequest(raw: string): Promise<string | null> {
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(raw);
  } catch {
    return error(0, -32700, "Parse error");
  }

  const id = req.id ?? null;
  const method = req.method ?? "";

  if (id === null) return null;

  if (method === "initialize") {
    return response(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "zeo-mcp-cli", version: "1.1.0" },
      capabilities: { tools: {} },
      schemaVersion: SCHEMA_VERSION,
      assumptions: ["tools are deterministic", "agent output is advisory only"],
      limits: ["requires preloaded contextId via CLI internal flow"],
    });
  }

  if (method === "tools/list") {
    return response(id, { schemaVersion: SCHEMA_VERSION, tools: TOOL_DEFS });
  }

  if (method === "tools/call") {
    const params = (req.params ?? {}) as Record<string, unknown>;
    const name = typeof params.name === "string" ? params.name : "";
    const args = typeof params.arguments === "object" && params.arguments !== null ? params.arguments as Record<string, unknown> : {};
    if (!name) return error(id, -32602, "Missing tool name in params");
    return response(id, await handleToolCall(name, args));
  }

  return error(id, -32601, `Method not found: ${method}`);
}

async function runServeCommand(args: McpCliArgs): Promise<number> {
  if (args.http) {
    process.stderr.write("[zeo mcp] HTTP transport is unsupported in CLI mode.\n");
    return 2;
  }

  const issues = validateMcpToolDefinitions();
  if (issues.length > 0) {
    process.stderr.write(`[zeo mcp] Invalid tool definitions: ${issues.join("; ")}\n`);
    return 1;
  }

  process.stderr.write("[zeo mcp] stdio transport ready\n");
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    void dispatchMcpRequest(trimmed).then((out) => { if (out) process.stdout.write(`${out}\n`); });
  });

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      rl.close();
      resolve();
    };
    process.on("SIGINT", shutdown);
    rl.on("close", shutdown);
  });

  return 0;
}

async function runPingCommand(): Promise<number> {
  const issues = validateMcpToolDefinitions();
  if (issues.length > 0) {
    console.error(`[MCP_SCHEMA_INVALID] ${issues.join("; ")}`);
    return 1;
  }
  console.log(`ok: initialize + tools/list (${TOOL_DEFS.length} tools, schema ${SCHEMA_VERSION})`);
  return 0;
}

async function runToolsCommand(): Promise<number> {
  for (const tool of TOOL_DEFS) console.log(tool.name);
  return 0;
}

async function runTestCommand(args: McpCliArgs): Promise<number> {
  const { runHandshakeTest, formatHandshakeTestResult } = await import("@zeo/mcp-server");
  const result = await runHandshakeTest();
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    console.log(formatHandshakeTestResult(result));
  }
  return result.failed > 0 ? 1 : 0;
}

export async function runMcpCommand(args: McpCliArgs): Promise<number> {
  if (!args.command) {
    help();
    return 1;
  }
  if (args.command === "serve") return runServeCommand(args);
  if (args.command === "ping") return runPingCommand();
  if (args.command === "test") return runTestCommand(args);
  return runToolsCommand();
}

