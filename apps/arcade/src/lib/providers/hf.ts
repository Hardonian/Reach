/**
 * Reach — Hugging Face Inference API adapter.
 *
 * Provides a drop-in model provider that routes inference requests
 * to the HF Inference API (or a self-hosted endpoint).
 *
 * Environment variables:
 *   HF_API_TOKEN       — required for public HF Inference API
 *   HF_BASE_URL        — optional override (default: https://api-inference.huggingface.co)
 *   HF_TIMEOUT_MS      — request timeout (default: 30000)
 *   HF_MAX_RETRIES     — max retries on transient errors (default: 3)
 */

export interface HFConfig {
  apiToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface HFTextGenerationInput {
  inputs: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    repetition_penalty?: number;
    return_full_text?: boolean;
  };
}

export interface HFTextGenerationOutput {
  generated_text: string;
}

export interface HFChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HFChatInput {
  model: string;
  messages: HFChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface HFChatOutput {
  choices: Array<{ message: HFChatMessage; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class HuggingFaceProvider {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: HFConfig = {}) {
    this.apiToken = config.apiToken ?? process.env.HF_API_TOKEN ?? '';
    this.baseUrl = config.baseUrl ?? process.env.HF_BASE_URL ?? 'https://api-inference.huggingface.co';
    this.timeoutMs = config.timeoutMs ?? parseInt(process.env.HF_TIMEOUT_MS ?? '30000', 10);
    this.maxRetries = config.maxRetries ?? parseInt(process.env.HF_MAX_RETRIES ?? '3', 10);
  }

  /** Text generation via pipeline endpoint */
  async generateText(model: string, input: HFTextGenerationInput): Promise<HFTextGenerationOutput[]> {
    const url = `${this.baseUrl}/pipeline/text-generation/${model}`;
    const result = await this.fetchWithRetry<HFTextGenerationOutput[]>(url, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return Array.isArray(result) ? result : [result];
  }

  /** Chat completion via Messages API (OpenAI-compatible) */
  async chat(input: HFChatInput): Promise<HFChatOutput> {
    const url = `${this.baseUrl}/models/${input.model}/v1/chat/completions`;
    return this.fetchWithRetry<HFChatOutput>(url, {
      method: 'POST',
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.max_tokens ?? 1024,
        temperature: input.temperature ?? 0.7,
        stream: false,
      }),
    });
  }

  /** Feature extraction (embeddings) */
  async embed(model: string, inputs: string | string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/pipeline/feature-extraction/${model}`;
    const result = await this.fetchWithRetry<number[][] | number[]>(url, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });
    if (Array.isArray(result) && Array.isArray(result[0])) return result as number[][];
    return [result as number[]];
  }

  private async fetchWithRetry<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> ?? {}),
        },
      });

      if (res.status === 503 && attempt < this.maxRetries) {
        // HF model loading — wait and retry
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '20', 10);
        await sleep(Math.min(retryAfter * 1000, 30000));
        return this.fetchWithRetry<T>(url, init, attempt + 1);
      }

      if (res.status === 429 && attempt < this.maxRetries) {
        // Rate limited — exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
        return this.fetchWithRetry<T>(url, init, attempt + 1);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HF API error ${res.status}: ${text.slice(0, 200)}`);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(`HF API timeout after ${this.timeoutMs}ms for ${url}`);
      }
      if (attempt < this.maxRetries && isTransient(err)) {
        await sleep(Math.pow(2, attempt) * 500);
        return this.fetchWithRetry<T>(url, init, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT') || err.message.includes('fetch failed');
}

// Singleton for convenience
let _hfProvider: HuggingFaceProvider | undefined;
export function getHFProvider(): HuggingFaceProvider {
  if (!_hfProvider) _hfProvider = new HuggingFaceProvider();
  return _hfProvider;
}
