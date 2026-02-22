// @ts-nocheck
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAgentsArgs, runAgentsCommand } from "./agents-cli.js";

const cwdStack: string[] = [];
function withTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeo-agents-"));
  cwdStack.push(process.cwd());
  process.chdir(dir);
  return dir;
}
afterEach(() => {
  const prev = cwdStack.pop();
  if (prev) process.chdir(prev);
});

describe("agents permissions", () => {
  it("requires explicit acceptance on add", async () => {
    const dir = withTemp();
    const agentDir = join(dir, "agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "zeo.agent.json"), JSON.stringify({
      id: "local-agent",
      version: "1.0.0",
      capabilities: [],
      requiredTools: ["tool.a"],
      requiredEnvVars: [],
      permissions: { fs: false, network: false }
    }, null, 2));

    const rc = await runAgentsCommand(parseAgentsArgs(["add", "agent"]));
    expect(rc).toBe(1);

    const rcAccepted = await runAgentsCommand(parseAgentsArgs(["add", "agent", "--accept"]));
    expect(rcAccepted).toBe(0);
  });

  it("recommends agents deterministically for a task", async () => {
    const dir = withTemp();
    const agentA = join(dir, "agent-a");
    const agentB = join(dir, "agent-b");
    mkdirSync(agentA, { recursive: true });
    mkdirSync(agentB, { recursive: true });
    writeFileSync(join(agentA, "zeo.agent.json"), JSON.stringify({
      id: "extractor-agent",
      version: "1.0.0",
      capabilities: ["extraction", "summarization"],
      requiredTools: [],
      requiredEnvVars: [],
      permissions: { fs: false, network: false }
    }, null, 2));
    writeFileSync(join(agentB, "zeo.agent.json"), JSON.stringify({
      id: "cost-agent",
      version: "1.0.0",
      capabilities: ["costing"],
      requiredTools: [],
      requiredEnvVars: [],
      permissions: { fs: false, network: false }
    }, null, 2));

    await runAgentsCommand(parseAgentsArgs(["add", "agent-a", "--accept"]));
    await runAgentsCommand(parseAgentsArgs(["add", "agent-b", "--accept"]));

    const orig = process.stdout.write;
    const firstOut: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => { firstOut.push(String(chunk)); return true; }) as typeof process.stdout.write;
    await runAgentsCommand(parseAgentsArgs(["recommend", "extraction", "--json"]));
    const first = JSON.parse(firstOut.join(""));

    const secondOut: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => { secondOut.push(String(chunk)); return true; }) as typeof process.stdout.write;
    await runAgentsCommand(parseAgentsArgs(["recommend", "extraction", "--json"]));
    process.stdout.write = orig;
    const second = JSON.parse(secondOut.join(""));

    expect(first).toEqual(second);
    expect(first.recommendations[0].agent).toBe("extractor-agent");
  });
});

