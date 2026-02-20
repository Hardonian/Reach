import { EconomicsConfig, LedgerEntry } from './types';

export interface CostBreakdown {
  compute_cost: number;
  token_cost: number;
  storage_cost: number;
  total_cost: number;
  currency: string;
  margin_at_tier: number | null;
}

/**
 * Calculate the total cost of a single execution run.
 * Includes token costs, compute costs, and optional storage costs.
 */
export function calculateRunCost(entry: LedgerEntry, config: EconomicsConfig): CostBreakdown {
  const modelRates = config.models[entry.model_id] || { input_1k: 0, output_1k: 0 };

  const token_cost =
    (entry.tokens_in / 1000 * modelRates.input_1k) +
    (entry.tokens_out / 1000 * modelRates.output_1k);

  const compute_cost = entry.duration_ms * config.compute.cost_per_ms;

  const storage_cost = (entry.storage_bytes ?? 0) * config.storage.cost_per_byte_month;

  const total_cost = compute_cost + token_cost + storage_cost;

  return {
    compute_cost,
    token_cost,
    storage_cost,
    total_cost,
    currency: config.currency,
    margin_at_tier: null,
  };
}

/**
 * Aggregate costs across multiple ledger entries with per-model and per-workflow breakdowns.
 */
export interface AggregatedCosts {
  total_cost: number;
  total_runs: number;
  avg_cost_per_run: number;
  total_tokens: number;
  avg_latency_ms: number;
  success_rate: number;
  cost_by_model: Record<string, number>;
  cost_by_workflow: Record<string, number>;
  cost_by_tenant: Record<string, number>;
}

export function aggregateCosts(entries: LedgerEntry[], config: EconomicsConfig): AggregatedCosts {
  let totalCost = 0;
  let totalTokens = 0;
  let totalDuration = 0;
  let successCount = 0;
  const costByModel: Record<string, number> = {};
  const costByWorkflow: Record<string, number> = {};
  const costByTenant: Record<string, number> = {};

  for (const entry of entries) {
    const cost = calculateRunCost(entry, config);
    totalCost += cost.total_cost;
    totalTokens += (entry.tokens_in + entry.tokens_out);
    totalDuration += entry.duration_ms;
    if (entry.status === 'success') successCount++;

    costByModel[entry.model_id] = (costByModel[entry.model_id] || 0) + cost.total_cost;
    costByWorkflow[entry.workflow_id] = (costByWorkflow[entry.workflow_id] || 0) + cost.total_cost;
    costByTenant[entry.tenant_id] = (costByTenant[entry.tenant_id] || 0) + cost.total_cost;
  }

  return {
    total_cost: totalCost,
    total_runs: entries.length,
    avg_cost_per_run: entries.length > 0 ? totalCost / entries.length : 0,
    total_tokens: totalTokens,
    avg_latency_ms: entries.length > 0 ? totalDuration / entries.length : 0,
    success_rate: entries.length > 0 ? successCount / entries.length : 0,
    cost_by_model: costByModel,
    cost_by_workflow: costByWorkflow,
    cost_by_tenant: costByTenant,
  };
}
