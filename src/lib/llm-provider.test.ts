import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createProvider, validateJsonSchema, __internal, SUPPORTED_PROVIDER_FIXTURE_NAMES } from "./llm-provider.js";
import type { LlmConfig } from "../cli/llm-cli.js";

const baseConfig: LlmConfig = {
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-4.1-mini",
  temperature: 0,
  seed: 7,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("llm provider request builders", () => {
  it("builds deterministic OpenAI requests", () => {
    const request = __internal.buildRequest("openai", baseConfig, [{ role: "user", content: "hi" }], { type: "object" }, 7, 0);
    expect(request.url).toContain("/chat/completions");
    expect(request.body.temperature).toBe(0);
    expect(request.body.seed).toBe(7);
  });

  it("builds deterministic Anthropic requests", () => {
    const request = __internal.buildRequest("anthropic", { ...baseConfig, provider: "anthropic" }, [{ role: "user", content: "hi" }], undefined, 7, 0);
    expect(request.url).toContain("/messages");
    expect(request.headers["anthropic-version"]).toBe("2023-06-01");
    expect(request.body.temperature).toBe(0);
  });

  it("builds deterministic OpenRouter requests", () => {
    const request = __internal.buildRequest("openrouter", { ...baseConfig, provider: "openrouter" }, [{ role: "user", content: "hi" }], { type: "object" }, 7, 0);
    expect(request.url).toContain("/chat/completions");
    expect(request.body.seed).toBe(7);
    expect(request.body.temperature).toBe(0);
  });

  it("builds deterministic Ollama requests", () => {
    const request = __internal.buildRequest("ollama", { ...baseConfig, provider: "ollama", apiKey: undefined }, [{ role: "user", content: "hi" }], { type: "object" }, 7, 0);
    expect(request.url).toContain("/api/chat");
    expect((request.body.options as Record<string, unknown>).temperature).toBe(0);
    expect((request.body.options as Record<string, unknown>).seed).toBe(7);
  });
});

describe("llm provider schema validation", () => {
  it("validates schema-constrained output", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ verdict: "ok" }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    } as Response)));

    const provider = createProvider(baseConfig);
    const result = await provider.chat([{ role: "user", content: "test" }], {
      type: "object",
      required: ["verdict"],
      properties: { verdict: { type: "string" } },
    });
    expect((result.json as Record<string, unknown>).verdict).toBe("ok");
  });

  it("throws on schema mismatch", () => {
    expect(() => validateJsonSchema({ verdict: 3 }, {
      type: "object",
      required: ["verdict"],
      properties: { verdict: { type: "string" } },
    })).toThrow(/Schema validation failed/);
  });
});

describe("provider response fixtures", () => {
  it("enforces one fixture filename per supported provider", () => {
    const fixtureDir = resolve(process.cwd(), "src/fixtures/provider-contracts");
    const providerFromFilename = readdirSync(fixtureDir)
      .filter((name) => name.endsWith(".response.json"))
      .map((name) => name.split(".")[0])
      .sort();

    expect(providerFromFilename).toEqual([...SUPPORTED_PROVIDER_FIXTURE_NAMES].sort());
  });

  it("parses recorded provider payload contracts", () => {
    const fixtureDir = resolve(process.cwd(), "src/fixtures/provider-contracts");
    const files = readdirSync(fixtureDir).filter((name) => name.endsWith(".response.json"));

    for (const file of files) {
      const fixture = JSON.parse(readFileSync(resolve(fixtureDir, file), "utf8")) as {
        provider: "openai" | "anthropic" | "openrouter" | "ollama";
        payload: Record<string, unknown>;
        expected: { json: unknown; usage: { inputTokens?: number; outputTokens?: number } };
      };

      expect(fixture.provider).toBe(file.split(".")[0]);
      const parsed = __internal.parseProviderResponse(fixture.provider, fixture.payload);
      expect(parsed.json).toEqual(fixture.expected.json);
      expect(parsed.usage).toEqual(fixture.expected.usage);
    }
  });


  it("covers malformed and nonjson negative fixtures for each provider", () => {
    const fixtureDir = resolve(process.cwd(), "src/fixtures/provider-contracts/negative");
    const files = readdirSync(fixtureDir).filter((name) => name.endsWith(".response.json"));
    const grouped = new Map<string, Set<string>>();

    for (const file of files) {
      const [provider, kind] = file.split(".");
      if (!grouped.has(provider)) grouped.set(provider, new Set());
      grouped.get(provider)?.add(kind);
    }

    for (const provider of SUPPORTED_PROVIDER_FIXTURE_NAMES) {
      expect(grouped.get(provider)).toBeDefined();
      expect(grouped.get(provider)?.has("malformed")).toBe(true);
      expect(grouped.get(provider)?.has("nonjson")).toBe(true);
      expect(grouped.get(provider)?.has("schemaarray")).toBe(true);
    }
  });


  it("validates schema-path diagnostics for array where object is expected", () => {
    const fixtureDir = resolve(process.cwd(), "src/fixtures/provider-contracts/negative");
    const files = readdirSync(fixtureDir).filter((name) => name.endsWith("schemaarray.response.json"));
    expect(files.length).toBe(4);

    const schema = {
      type: "object",
      required: ["verdict"],
      properties: { verdict: { type: "string" } },
    };

    for (const file of files) {
      const fixture = JSON.parse(readFileSync(resolve(fixtureDir, file), "utf8")) as {
        provider: "openai" | "anthropic" | "openrouter" | "ollama";
        payload: Record<string, unknown>;
        expectedSchemaError: string;
      };

      const parsed = __internal.parseProviderResponse(fixture.provider, fixture.payload);
      expect(() => validateJsonSchema(parsed.json, schema)).toThrow(fixture.expectedSchemaError);
    }
  });

  it("fails with explicit diagnostics for malformed provider envelopes", () => {
    const fixtureDir = resolve(process.cwd(), "src/fixtures/provider-contracts/negative");
    const files = readdirSync(fixtureDir).filter((name) => name.endsWith(".response.json"));

    for (const file of files) {
      const fixture = JSON.parse(readFileSync(resolve(fixtureDir, file), "utf8")) as {
        provider: "openai" | "anthropic" | "openrouter" | "ollama";
        payload: Record<string, unknown>;
        expectedError?: string;
      };

      if (!fixture.expectedError) continue;
      expect(() => __internal.parseProviderResponse(fixture.provider, fixture.payload)).toThrow(fixture.expectedError);
    }
  });
});
