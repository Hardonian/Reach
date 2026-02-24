// @ts-nocheck
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { LlmConfig, LlmProviderName } from "../core/llm-types.ts";

interface DoctorArgs {
  command: "doctor" | null;
  provider?: LlmProviderName;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function parseLlmArgs(argv: string[]): DoctorArgs {
  const command = argv[0] === "doctor" ? "doctor" : null;
  const args: DoctorArgs = { command };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--provider" || arg === "-p") && next) args.provider = next as LlmProviderName;
    if (arg === "--model" && next) args.model = next;
    if (arg === "--base-url" && next) args.baseUrl = next;
    if (arg === "--api-key" && next) args.apiKey = next;
  }
  return args;
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function resolveLlmConfig(args: DoctorArgs): LlmConfig {
  const root = process.cwd();
  const projectConfig = readJson(resolve(root, ".zeo/config.json"));
  const localConfig = readJson(resolve(root, ".zeo/config.local.json"));
  const env = process.env;

  const provider = args.provider
    ?? (localConfig.llm as any)?.provider
    ?? (projectConfig.llm as any)?.provider
    ?? env.ZEO_LLM_PROVIDER
    ?? "openai";

  const model = args.model
    ?? (localConfig.llm as any)?.model
    ?? (projectConfig.llm as any)?.model
    ?? env.ZEO_LLM_MODEL
    ?? "gpt-4.1-mini";

  const baseUrl = args.baseUrl
    ?? (localConfig.llm as any)?.baseUrl
    ?? (projectConfig.llm as any)?.baseUrl
    ?? env.ZEO_LLM_BASE_URL;

  const apiKey = args.apiKey
    ?? (localConfig.llm as any)?.apiKey
    ?? (projectConfig.llm as any)?.apiKey
    ?? env.ZEO_LLM_API_KEY
    ?? env.OPENAI_API_KEY
    ?? env.ANTHROPIC_API_KEY
    ?? env.OPENROUTER_API_KEY;

  const temperature = 0;
  const seed = Number(env.ZEO_LLM_SEED ?? "7");

  const normalized = provider === "custom" ? "ollama" : provider;
  if (!["openai", "anthropic", "openrouter", "ollama"].includes(normalized)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!["ollama"].includes(normalized) && !apiKey) {
    throw new Error(`Missing API key for provider ${normalized}. Set via --api-key or env/config.`);
  }

  if ((projectConfig.llm as any)?.apiKey || (localConfig.llm as any)?.apiKey) {
    throw new Error("API keys in .zeo/config*.json are forbidden. Use environment variables or --api-key at runtime.");
  }

  return { provider: normalized as LlmProviderName, model, baseUrl, apiKey, temperature, seed };
}

async function providerHealth(config: LlmConfig): Promise<{ reachable: boolean; modelAvailable: boolean; details: string }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  let url = "";

  if (config.provider === "openai") {
    url = `${config.baseUrl ?? "https://api.openai.com/v1"}/models/${config.model}`;
    headers.authorization = `Bearer ${config.apiKey}`;
  } else if (config.provider === "anthropic") {
    url = `${config.baseUrl ?? "https://api.anthropic.com"}/v1/models`;
    headers["x-api-key"] = config.apiKey ?? "";
    headers["anthropic-version"] = "2023-06-01";
  } else if (config.provider === "openrouter") {
    url = `${config.baseUrl ?? "https://openrouter.ai/api/v1"}/models`;
    headers.authorization = `Bearer ${config.apiKey}`;
  } else {
    url = `${config.baseUrl ?? "http://127.0.0.1:11434"}/api/tags`;
  }

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) return { reachable: false, modelAvailable: false, details: `HTTP ${response.status}` };
  const payload = await response.json() as Record<string, unknown>;
  const serialized = JSON.stringify(payload);
  return { reachable: true, modelAvailable: serialized.includes(config.model), details: "ok" };
}

function printHelp(): void {
  console.log("\nZeo LLM Commands\n\nUsage:\n  zeo llm doctor [--provider <name>] [--model <id>] [--base-url <url>]\n");
}

export async function runLlmCommand(args: DoctorArgs): Promise<number> {
  if (!args.command) {
    printHelp();
    return 1;
  }

  const config = resolveLlmConfig(args);
  const health = await providerHealth(config);
  if (!health.reachable) {
    console.error(`[LLM_DOCTOR_FAILED] Provider unreachable: ${health.details}`);
    return 2;
  }
  if (!health.modelAvailable) {
    console.error(`[LLM_DOCTOR_FAILED] Model '${config.model}' unavailable for provider '${config.provider}'.`);
    return 3;
  }
  if (config.temperature !== 0) {
    console.error("[LLM_DOCTOR_FAILED] Non-deterministic temperature; must be 0.");
    return 4;
  }

  console.log(JSON.stringify({
    status: "ok",
    provider: config.provider,
    model: config.model,
    deterministic: { temperature: config.temperature, seed: config.seed },
  }, null, 2));
  return 0;
}

