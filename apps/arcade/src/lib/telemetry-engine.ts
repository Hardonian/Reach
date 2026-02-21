/**
 * ReadyLayer Internal Telemetry Engine
 * 
 * Provides internal event tracking for:
 * - first_success_event
 * - gate_enabled_event
 * - monitor_created_event
 * - simulation_run_event
 * 
 * Includes internal metrics endpoint and event validation guard.
 * 
 * @module telemetry-engine
 */

import { z } from 'zod';

// ── Event Types ────────────────────────────────────────────────────────────────

/**
 * Internal telemetry event types.
 */
export type TelemetryEventType = 
  | 'first_success_event'
  | 'gate_enabled_event'
  | 'monitor_created_event'
  | 'simulation_run_event'
  | 'workflow_created'
  | 'workflow_executed'
  | 'pack_installed'
  | 'gate_triggered'
  | 'alert_triggered'
  | 'provider_switched';

/**
 * Telemetry event payload.
 */
export interface TelemetryEvent {
  id: string;
  event_type: TelemetryEventType;
  tenant_id?: string;
  user_id?: string;
  session_id?: string;
  properties: Record<string, unknown>;
  timestamp: string;
  validated: boolean;
  valid: boolean;
  validation_errors?: string[];
}

// ── Event Schemas ───────────────────────────────────────────────────────────

/**
 * Schema for first_success_event.
 */
export const FirstSuccessEventSchema = z.object({
  event_type: z.literal('first_success_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  workflow_id: z.string(),
  run_id: z.string(),
  latency_ms: z.number().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

/**
 * Schema for gate_enabled_event.
 */
export const GateEnabledEventSchema = z.object({
  event_type: z.literal('gate_enabled_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  gate_id: z.string(),
  gate_name: z.string(),
  repo_provider: z.string().optional(),
  repo_full_name: z.string().optional(),
  trigger_types: z.array(z.string()).optional(),
});

/**
 * Schema for monitor_created_event.
 */
export const MonitorCreatedEventSchema = z.object({
  event_type: z.literal('monitor_created_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  signal_id: z.string(),
  signal_type: z.string(),
  threshold_config: z.record(z.unknown()).optional(),
});

/**
 * Schema for simulation_run_event.
 */
export const SimulationRunEventSchema = z.object({
  event_type: z.literal('simulation_run_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  scenario_id: z.string(),
  scenario_run_id: z.string(),
  variant_count: z.number().int().positive(),
  status: z.enum(['running', 'completed', 'failed']),
  duration_ms: z.number().optional(),
});

/**
 * Union schema for all event types.
 */
export const TelemetryEventSchema = z.union([
  FirstSuccessEventSchema,
  GateEnabledEventSchema,
  MonitorCreatedEventSchema,
  SimulationRunEventSchema,
  z.object({
    event_type: z.string(),
    tenant_id: z.string().optional(),
    user_id: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
  }),
]);

// ── Event Validator ─────────────────────────────────────────────────────────

/**
 * Validates an event against its schema.
