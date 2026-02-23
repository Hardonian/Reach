export interface BreakEvenAnalysis {
  users_needed: number;
  runs_per_day_needed: number;
  current_margin: number;
}

export function calculateBreakEven(
  avg_cost_per_run: number,
  pricing_tier_monthly: number,
  fixed_costs_monthly: number,
): BreakEvenAnalysis {
  // Simple model: Revenue = Users * Price
  // Cost = Fixed + (Users * Runs/User * Cost/Run)
  // Let's assume 100 runs/user/month for the baseline
  const runs_per_user_month = 100;

  const variable_cost_per_user = runs_per_user_month * avg_cost_per_run;
  const contribution_margin_per_user =
    pricing_tier_monthly - variable_cost_per_user;

  if (contribution_margin_per_user <= 0) {
    return {
      users_needed: Infinity,
      runs_per_day_needed: Infinity,
      current_margin: contribution_margin_per_user,
    };
  }

  return {
    users_needed: Math.ceil(fixed_costs_monthly / contribution_margin_per_user),
    runs_per_day_needed: Math.ceil(
      (fixed_costs_monthly / contribution_margin_per_user) *
        (runs_per_user_month / 30),
    ),
    current_margin: contribution_margin_per_user,
  };
}
