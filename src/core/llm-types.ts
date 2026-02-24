export type LlmProviderName = "openai" | "anthropic" | "openrouter" | "ollama" | "custom";

export interface LlmConfig {
  provider: LlmProviderName;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  seed: number;
}
