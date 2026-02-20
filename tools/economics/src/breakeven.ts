import { PLAN_TIERS, PlanTier } from './types';

export interface BreakEvenAnalysis {
  tier: string;
  users_needed: number;
  runs_per_day_needed: number;
  current_margin: number;
  ltv_estimate: number;
}

/**
 * Calculate break-even metrics for a given plan tier.
 *
 * @param avg_cost_per_run - Average variable cost per execution run
 * @param pricing_tier_monthly - Monthly subscription price
 * @param fixed_costs_monthly - Total fixed costs per month (infra, team, etc.)
 * @param runs_per_user_month - Expected runs per user per month (default: from tier config)
 */
export function calculateBreakEven(
  avg_cost_per_run: number,
  pricing_tier_monthly: number,
  fixed_costs_monthly: number,
  runs_per_user_month: number = 100
): BreakEvenAnalysis {
  const variable_cost_per_user = runs_per_user_month * avg_cost_per_run;
  const contribution_margin_per_user = pricing_tier_monthly - variable_cost_per_user;

  if (contribution_margin_per_user <= 0) {
    return {
      tier: 'custom',
      users_needed: Infinity,
      runs_per_day_needed: Infinity,
      current_margin: contribution_margin_per_user,
      ltv_estimate: 0,
    };
  }

  const users_needed = Math.ceil(fixed_costs_monthly / contribution_margin_per_user);

  return {
    tier: 'custom',
    users_needed,
    runs_per_day_needed: Math.ceil(users_needed * (runs_per_user_month / 30)),
    current_margin: contribution_margin_per_user,
    ltv_estimate: contribution_margin_per_user * 12, // Annualized
  };
}

/**
 * Run break-even analysis across all standard plan tiers.
 */
export function analyzeAllTiers(
  avg_cost_per_run: number,
  fixed_costs_monthly: number
): BreakEvenAnalysis[] {
  return Object.entries(PLAN_TIERS).map(([key, tier]) => {
    const result = calculateBreakEven(
      avg_cost_per_run,
      tier.monthly_price,
      fixed_costs_monthly,
      tier.runs_per_month
    );
    result.tier = key;
    return result;
  });
}
