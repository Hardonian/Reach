import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.string(),
  currency: z.string(),
  compute: z.object({
    cost_per_ms: z.number(),
    description: z.string().optional(),
  }),
  storage: z.object({
    cost_per_byte_month: z.number(),
    description: z.string().optional(),
  }),
  models: z.record(z.object({
    input_1k: z.number(),
    output_1k: z.number(),
  })),
});

export type EconomicsConfig = z.infer<typeof ConfigSchema>;

export interface LedgerEntry {
  id: string;
  timestamp: string;
  tenant_id: string;
  workflow_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  status: 'success' | 'failure';
}
