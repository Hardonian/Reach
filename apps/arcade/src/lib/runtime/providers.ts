/**
 * ReadyLayer Provider Routing
 *
 * OpenRouter-style abstraction with:
 * - Default provider selection
 * - Model-level fallback
 * - Cost vs latency toggle
 * - Failure auto-fallback
 */

import type { ProviderConfig, ProviderRoutingResult, ProviderModel } from './types';

// ── Built-in Providers ──

export const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    isDefault: true,
    models: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', maxTokens: 32000, costPer1kInput: 0.015, costPer1kOutput: 0.075, avgLatencyMs: 2500 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxTokens: 16000, costPer1kInput: 0.003, costPer1kOutput: 0.015, avgLatencyMs: 1200 },
      { id: 'claude-haiku-3-20250514', name: 'Claude Haiku 3.5', maxTokens: 8000, costPer1kInput: 0.00025, costPer1kOutput: 0.00125, avgLatencyMs: 400 },
    ],
    fallbackProviderId: 'openrouter',
    costWeight: 0.5,
    latencyWeight: 0.5,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    isDefault: false,
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OR)', maxTokens: 16000, costPer1kInput: 0.003, costPer1kOutput: 0.015, avgLatencyMs: 1400 },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OR)', maxTokens: 16000, costPer1kInput: 0.005, costPer1kOutput: 0.015, avgLatencyMs: 1000 },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (via OR)', maxTokens: 32000, costPer1kInput: 0.007, costPer1kOutput: 0.021, avgLatencyMs: 1100 },
    ],
    costWeight: 0.7,
    latencyWeight: 0.3,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    isDefault: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 16000, costPer1kInput: 0.005, costPer1kOutput: 0.015, avgLatencyMs: 900 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 16000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, avgLatencyMs: 300 },
    ],
    fallbackProviderId: 'openrouter',
    costWeight: 0.5,
    latencyWeight: 0.5,
  },
];

// ── Routing Logic ──

export type RoutingStrategy = 'default' | 'cost-optimized' | 'latency-optimized';

export function routeToProvider(
  strategy: RoutingStrategy = 'default',
  preferredProviderId?: string,
): ProviderRoutingResult {
  const providers = getAllProviders();

  // If preferred provider specified, try it first
  if (preferredProviderId) {
    const preferred = providers.find((p) => p.id === preferredProviderId);
    if (preferred && preferred.models.length > 0) {
      const model = selectModel(preferred, strategy);
      return {
        providerId: preferred.id,
        providerName: preferred.name,
        modelId: model.id,
        modelName: model.name,
        reason: 'default',
        attemptNumber: 1,
      };
    }
  }

  // Use default provider
  const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0];
  const model = selectModel(defaultProvider, strategy);

  return {
    providerId: defaultProvider.id,
    providerName: defaultProvider.name,
    modelId: model.id,
    modelName: model.name,
    reason: 'default',
    attemptNumber: 1,
  };
}

export function fallbackRoute(
  failedProviderId: string,
  attemptNumber: number,
): ProviderRoutingResult | null {
  const failed = getProvider(failedProviderId);
  if (!failed?.fallbackProviderId) return null;

  const fallback = getProvider(failed.fallbackProviderId);
  if (!fallback || fallback.models.length === 0) return null;

  return {
    providerId: fallback.id,
    providerName: fallback.name,
    modelId: fallback.models[0].id,
    modelName: fallback.models[0].name,
    reason: 'fallback',
    attemptNumber: attemptNumber + 1,
  };
}

function selectModel(provider: ProviderConfig, strategy: RoutingStrategy): ProviderModel {
  const models = provider.models;
  if (models.length === 0) throw new Error(`Provider ${provider.id} has no models`);

  if (strategy === 'cost-optimized') {
    return [...models].sort((a, b) => a.costPer1kInput - b.costPer1kInput)[0];
  }

  if (strategy === 'latency-optimized') {
    return [...models].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
  }

  // Default: use first model (typically the recommended one)
  return models[0];
}

// ── Registry ──

export function getProvider(id: string): ProviderConfig | undefined {
  return BUILTIN_PROVIDERS.find((p) => p.id === id);
}

export function getAllProviders(): ProviderConfig[] {
  return [...BUILTIN_PROVIDERS];
}

export function getDefaultProvider(): ProviderConfig {
  return BUILTIN_PROVIDERS.find((p) => p.isDefault) ?? BUILTIN_PROVIDERS[0];
}
