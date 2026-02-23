import type { LlmConfig, LlmProviderName } from "../cli/llm-cli.js";
// @ts-ignore
import { LlmCli } from "../cli/llm-cli.js";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmProvider {
  chat(messages: LlmMessage[], jsonSchema?: Record<string, unknown>, seed?: number, temperature?: number): Promise<{ json: unknown; usage: LlmUsage }>;
}


export const SUPPORTED_PROVIDER_FIXTURE_NAMES = ["openai", "anthropic", "openrouter", "ollama"] as const;

interface RequestShape {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface ProviderResponse {
  json: unknown;
  usage: LlmUsage;
}

function validateDeterminism(seed: number, temperature: number): void {
  if (!Number.isInteger(seed) || seed < 0) throw new Error("seed must be a non-negative integer");
  if (temperature !== 0) throw new Error("temperature must be 0 for deterministic mode");
}

function normalizeBaseUrl(provider: LlmProviderName, baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "anthropic") return "https://api.anthropic.com/v1";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return "http://127.0.0.1:11434";
}

function asOpenAiMessages(messages: LlmMessage[]): Array<Record<string, string>> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function buildRequest(provider: LlmProviderName, config: LlmConfig, messages: LlmMessage[], jsonSchema: Record<string, unknown> | undefined, seed: number, temperature: number): RequestShape {
  const baseUrl = normalizeBaseUrl(provider, config.baseUrl);

  if (provider === "openai") {
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: {
        model: config.model,
        messages: asOpenAiMessages(messages),
        temperature,
        seed,
        ...(jsonSchema
          ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "zeo_schema",
                strict: true,
                schema: jsonSchema,
              },
            },
          }
          : {}),
      },
    };
  }

  if (provider === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const conversation = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    return {
      url: `${baseUrl}/messages`,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: config.model,
        temperature,
        messages: conversation,
        system,
        max_tokens: 1024,
      },
    };
  }

  if (provider === "openrouter") {
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: {
        model: config.model,
        messages: asOpenAiMessages(messages),
        temperature,
        seed,
        response_format: jsonSchema ? { type: "json_object" } : undefined,
      },
    };
  }

  return {
    url: `${baseUrl}/api/chat`,
    headers: {
      "content-type": "application/json",
    },
    body: {
      model: config.model,
      stream: false,
      messages: asOpenAiMessages(messages),
      format: jsonSchema ?? undefined,
      options: { temperature, seed },
    },
  };
}

function tryParseJsonObject(raw: string, provider: LlmProviderName): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Provider '${provider}' returned non-JSON content`);
  }
}

function parseProviderResponse(provider: LlmProviderName, payload: Record<string, unknown>): ProviderResponse {
  if (provider === "openai" || provider === "openrouter") {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = (first?.message ?? {}) as Record<string, unknown>;
    const content = message.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error(`Malformed ${provider} response: missing choices[0].message.content`);
    }
    return {
      json: tryParseJsonObject(content, provider),
      usage: {
        inputTokens: typeof (payload.usage as Record<string, unknown> | undefined)?.prompt_tokens === "number"
          ? (payload.usage as Record<string, number>).prompt_tokens
          : undefined,
        outputTokens: typeof (payload.usage as Record<string, unknown> | undefined)?.completion_tokens === "number"
          ? (payload.usage as Record<string, number>).completion_tokens
          : undefined,
      },
    };
  }

  if (provider === "anthropic") {
    const content = Array.isArray(payload.content) ? payload.content : [];
    const first = content[0] as Record<string, unknown> | undefined;
    const text = typeof first?.text === "string" ? first.text : "";
    if (!text.trim()) {
      throw new Error("Malformed anthropic response: missing content[0].text");
    }
    return {
      json: tryParseJsonObject(text, provider),
      usage: {
        inputTokens: typeof (payload.usage as Record<string, unknown> | undefined)?.input_tokens === "number"
          ? (payload.usage as Record<string, number>).input_tokens
          : undefined,
        outputTokens: typeof (payload.usage as Record<string, unknown> | undefined)?.output_tokens === "number"
          ? (payload.usage as Record<string, number>).output_tokens
          : undefined,
      },
    };
  }

  const message = (payload.message ?? {}) as Record<string, unknown>;
  const content = message.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Malformed ollama response: missing message.content");
  }
  return {
    json: tryParseJsonObject(content, provider),
    usage: {
      inputTokens: typeof (payload.prompt_eval_count) === "number" ? payload.prompt_eval_count as number : undefined,
      outputTokens: typeof (payload.eval_count) === "number" ? payload.eval_count as number : undefined,
    },
  };
}


function schemaType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateSchemaValue(value: unknown, schema: Record<string, unknown>, path: string): void {
  const expected = schema.type;
  if (typeof expected === "string") {
    if (expected === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Schema validation failed at ${path}: expected object, received ${schemaType(value)}`);
      }
      const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      for (const req of required) {
        if (!(req in (value as Record<string, unknown>))) {
          throw new Error(`Schema validation failed at ${path}: missing required property '${req}'`);
        }
      }
      for (const [key, nestedSchema] of Object.entries(properties)) {
        if (key in (value as Record<string, unknown>)) {
          validateSchemaValue((value as Record<string, unknown>)[key], nestedSchema, `${path}.${key}`);
        }
      }
      return;
    }

    if (expected === "array") {
      if (!Array.isArray(value)) throw new Error(`Schema validation failed at ${path}: expected array, received ${schemaType(value)}`);
      const itemSchema = (schema.items ?? {}) as Record<string, unknown>;
      if (Object.keys(itemSchema).length > 0) {
        value.forEach((item, idx) => validateSchemaValue(item, itemSchema, `${path}[${idx}]`));
      }
      return;
    }

    if (expected !== schemaType(value)) {
      throw new Error(`Schema validation failed at ${path}: expected ${expected}, received ${schemaType(value)}`);
    }
  }
}

export function validateJsonSchema(value: unknown, schema?: Record<string, unknown>): void {
  if (!schema) return;
  validateSchemaValue(value, schema, "$" );
}

export function createProvider(config: LlmConfig): LlmProvider {
  return {
    async chat(messages, jsonSchema, seed = config.seed, temperature = 0) {
      validateDeterminism(seed, temperature);
      const provider = config.provider === "custom" ? "ollama" : config.provider;
      const req = buildRequest(provider, config, messages, jsonSchema, seed, temperature);
      const response = await fetch(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(req.body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Provider request failed with status ${response.status}: ${detail}`);
      }
      const payload = await response.json() as Record<string, unknown>;
      const parsed = parseProviderResponse(provider, payload);
      validateJsonSchema(parsed.json, jsonSchema);
      return parsed;
    },
  };
}

export const __internal = {
  buildRequest,
  parseProviderResponse,
};
