/**
 * Junction Types
 * 
 * Type definitions for the Junction orchestration system.
 */

import { z } from 'zod';

/**
 * Junction types
 */
export type JunctionType = 'diff_critical' | 'drift_alert' | 'trust_drop' | 'policy_violation';

/**
 * Junction status
 */
export type JunctionStatus = 'triggered' | 'acknowledged' | 'resolved' | 'superseded';

/**
 * Junction trigger data
 */
export const JunctionTriggerDataSchema = z.object({
  sourceRef: z.string(),
  severity: z.number().min(0).max(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type JunctionTriggerData = z.infer<typeof JunctionTriggerDataSchema>;

/**
 * Junction configuration
 */
export const JunctionSettingsSchema = z.object({
  type: z.string(),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().default(60),
  severityThreshold: z.number().min(0).max(1).default(0.5),
  dedupeWindowMinutes: z.number().default(60),
});

export type JunctionSettings = z.infer<typeof JunctionSettingsSchema>;

/**
 * Junction template result
 */
export interface JunctionTemplateResult {
  type: JunctionType;
  severityScore: number;
  fingerprint: string;
  triggerSourceRef: string;
  triggerData: string;
  triggerTrace: string[];
  shouldTrigger: boolean;
  reason: string;
}

/**
 * Junction scan result
 */
export interface JunctionScanResult {
  triggered: JunctionTemplateResult[];
  skipped: JunctionTemplateResult[];
  errors: { source: string; error: string }[];
}
