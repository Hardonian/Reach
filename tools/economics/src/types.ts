import { z } from 'zod';

export const ModelRateSchema = z.object({
  input_1k: z.number().nonnegative(),
  output_1k: z.number().nonnegative(),
});

export const ConfigSchema = z.object({
  version: z.string(),
  currency: z.string().default('USD'),
  compute: z.object({
    cost_per_ms: z.number().nonnegative(),
    description: z.string().optional(),
  }),
  storage: z.object({
    cost_per_byte_month: z.number().nonnegative(),
    description: z.string().optional(),
  }),
  models: z.record(ModelRateSchema),
});

export type EconomicsConfig = z.infer<typeof ConfigSchema>;

export const LedgerEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  tenant_id: z.string().min(1),
  workflow_id: z.string().min(1),
  model_id: z.string().min(1),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  duration_ms: z.number().nonnegative(),
  storage_bytes: z.number().int().nonnegative().optional(),
  status: z.enum(['success', 'failure']),
  plan_tier: z.enum(['free', 'pro', 'enterprise']).optional(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

/** Plan tier pricing configuration. */
export interface PlanTier {
  name: string;
  monthly_price: number;
  runs_per_month: number;
  retention_days: number;
}

/** Standard plan tiers for break-even analysis. */
export const PLAN_TIERS: Record<string, PlanTier> = {
  free: { name: 'Free', monthly_price: 0, runs_per_month: 50, retention_days: 7 },
  pro: { name: 'Pro', monthly_price: 29, runs_per_month: 1000, retention_days: 90 },
  enterprise: { name: 'Enterprise', monthly_price: 299, runs_per_month: 50000, retention_days: 365 },
};
