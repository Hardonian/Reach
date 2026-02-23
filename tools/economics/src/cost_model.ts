import { EconomicsConfig, LedgerEntry } from "./types";

export interface CostBreakdown {
  compute_cost: number;
  token_cost: number;
  total_cost: number;
  currency: string;
}

export function calculateRunCost(entry: LedgerEntry, config: EconomicsConfig): CostBreakdown {
  const modelRates = config.models[entry.model_id] || {
    input_1k: 0,
    output_1k: 0,
  };

  const token_cost =
    (entry.tokens_in / 1000) * modelRates.input_1k +
    (entry.tokens_out / 1000) * modelRates.output_1k;

  const compute_cost = entry.duration_ms * config.compute.cost_per_ms;

  return {
    compute_cost,
    token_cost,
    total_cost: compute_cost + token_cost,
    currency: config.currency,
  };
}
