/**
 * Tools CLI
 *
 * zeo tools — Show agent/tool health status (READY | ERROR | TIMEOUT)
 */

export async function runToolsCommand(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const core = await import("@zeo/core");

  // Register default tools
  const defaultAgents: Array<{ name: string; description: string; timeoutMs: number }> = [
    { name: "branch_generator", description: "Generate decision branch graphs", timeoutMs: 5000 },
    { name: "robustness_evaluator", description: "Evaluate action robustness", timeoutMs: 5000 },
    { name: "expected_utility_evaluator", description: "Qualitative expected utility analysis", timeoutMs: 5000 },
    { name: "game_theory_evaluator", description: "Game-theoretic analysis", timeoutMs: 5000 },
    { name: "evolutionary_evaluator", description: "Evolutionary fitness evaluation", timeoutMs: 5000 },
    { name: "flip_condition_generator", description: "Identify assumption flip conditions", timeoutMs: 5000 },
    { name: "evidence_ranker", description: "Rank evidence by VOI", timeoutMs: 5000 },
    { name: "mcp_server", description: "MCP stdio server", timeoutMs: 10000 },
    { name: "replay_engine", description: "Deterministic replay verification", timeoutMs: 30000 },
    { name: "evidence_graph", description: "Persistent evidence registry", timeoutMs: 5000 },
    { name: "plan_engine", description: "Regret-aware planning", timeoutMs: 10000 },
  ];

  for (const agent of defaultAgents) {
    core.registerAgent({
      name: agent.name,
      description: agent.description,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      costEstimate: { tokensMin: 0, tokensMax: 1000, costUsdMin: 0, costUsdMax: 0.01 },
      timeoutMs: agent.timeoutMs,
    });
  }

  // Check health of all registered agents
  const healthResults: Array<{ name: string; status: string; latencyMs?: number; error?: string }> = [];

  for (const agent of defaultAgents) {
    const health = await core.checkAgentHealth(agent.name);
    healthResults.push({
      name: health.name,
      status: health.status,
      latencyMs: health.latencyMs,
      error: health.error,
    });
  }

  // Also check MCP tools
  try {
    const { validateMcpToolDefinitions } = await import("./mcp-cli.js");
    const issues = validateMcpToolDefinitions();
    healthResults.push({
      name: "mcp_tools_schema",
      status: issues.length === 0 ? "READY" : "ERROR",
      error: issues.length > 0 ? issues.join("; ") : undefined,
    });
  } catch {
    healthResults.push({ name: "mcp_tools_schema", status: "ERROR", error: "MCP module unavailable" });
  }

  // Check snapshot storage
  try {
    const snapshots = core.listSnapshots();
    healthResults.push({
      name: "snapshot_storage",
      status: "READY",
      latencyMs: 0,
    });
  } catch {
    healthResults.push({ name: "snapshot_storage", status: "ERROR", error: "Snapshot storage inaccessible" });
  }

  // Check evidence graph
  try {
    const graph = core.loadEvidenceGraph();
    healthResults.push({
      name: "evidence_store",
      status: "READY",
      latencyMs: 0,
    });
  } catch {
    healthResults.push({ name: "evidence_store", status: "ERROR", error: "Evidence graph inaccessible" });
  }

  if (json) {
    console.log(JSON.stringify(healthResults, null, 2));
  } else {
    console.log("\n=== Zeo Tools Status ===\n");
    for (const h of healthResults) {
      const statusStr = h.status === "READY" ? "READY  " : h.status === "TIMEOUT" ? "TIMEOUT" : "ERROR  ";
      const latency = h.latencyMs !== undefined ? ` (${h.latencyMs}ms)` : "";
      console.log(`  [${statusStr}] ${h.name}${latency}`);
      if (h.error) console.log(`           ${h.error}`);
    }
    console.log("");
  }

  const hasErrors = healthResults.some(h => h.status === "ERROR" || h.status === "TIMEOUT");
  return hasErrors ? 1 : 0;
}
