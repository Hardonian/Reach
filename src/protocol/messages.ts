/**
 * Protocol Message Types (TypeScript)
 * 
 * TypeScript equivalents of the Rust message payloads.
 * Uses CBOR for serialization with fixed-point numeric types.
 */

import * as cbor from 'cbor';

// ============================================================================
// Fixed-Point Numeric Types
// ============================================================================

/**
 * Fixed-point Q32.32 format (64-bit)
 * 
 * Represented as raw i64 in protocol.
 * Use conversion functions for f64 operations.
 */
export type FixedQ32_32 = bigint;

export function q32_32FromF64(value: number): FixedQ32_32 {
  if (!Number.isFinite(value)) {
    throw new Error('Cannot convert NaN or Infinity to FixedQ32_32');
  }
  const SCALE = BigInt(1) << BigInt(32);
  return BigInt(Math.round(value * Number(SCALE)));
}

export function q32_32ToF64(value: FixedQ32_32): number {
  const SCALE = BigInt(1) << BigInt(32);
  return Number(value) / Number(SCALE);
}

/**
 * Basis points (16-bit)
 * 100 bps = 1%, 10000 bps = 100%
 */
export type FixedBps = number;

export function bpsFromPercent(percent: number): FixedBps {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: FixedBps): number {
  return bps / 100;
}

/**
 * Parts per million (32-bit)
 * 1,000,000 ppm = 100%
 */
export type FixedPpm = number;

export function ppmFromRatio(ratio: number): FixedPpm {
  return Math.round(ratio * 1_000_000);
}

export function ppmToRatio(ppm: FixedPpm): number {
  return ppm / 1_000_000;
}

/**
 * Duration in microseconds (64-bit)
 */
export type FixedDuration = bigint;

export const Duration = {
  ZERO: BigInt(0) as FixedDuration,
  
  fromMicros(micros: number | bigint): FixedDuration {
    return BigInt(micros);
  },
  
  fromMillis(millis: number | bigint): FixedDuration {
    return BigInt(millis) * BigInt(1000);
  },
  
  fromSeconds(seconds: number | bigint): FixedDuration {
    return BigInt(seconds) * BigInt(1_000_000);
  },
  
  toMicros(d: FixedDuration): bigint {
    return d;
  },
  
  toMillis(d: FixedDuration): bigint {
    return d / BigInt(1000);
  },
  
  toSeconds(d: FixedDuration): bigint {
    return d / BigInt(1_000_000);
  },
};

/**
 * Throughput in micro-operations per second
 */
export type FixedThroughput = bigint;

export function throughputFromOpsPerSec(ops: number): FixedThroughput {
  return BigInt(Math.round(ops * 1_000_000));
}

export function throughputToOpsPerSec(tp: FixedThroughput): number {
  return Number(tp) / 1_000_000;
}

// ============================================================================
// Capability Flags
// ============================================================================

export enum CapabilityFlags {
  NONE = 0,
  BINARY_PROTOCOL = 1 << 0,
  CBOR_ENCODING = 1 << 1,
  COMPRESSION = 1 << 2,
  SANDBOX = 1 << 3,
  LLM = 1 << 4,
  FIXED_POINT = 1 << 5,
  STREAMING = 1 << 6,
}

// ============================================================================
// Message Payloads
// ============================================================================

export interface HelloPayload {
  client_name: string;
  client_version: string;
  min_version: [number, number];
  max_version: [number, number];
  capabilities: CapabilityFlags;
  preferred_encoding: 'cbor' | 'json';
}

export function createHello(
  clientName: string,
  clientVersion: string
): HelloPayload {
  return {
    client_name: clientName,
    client_version: clientVersion,
    min_version: [1, 0],
    max_version: [1, 0],
    capabilities: CapabilityFlags.BINARY_PROTOCOL |
                  CapabilityFlags.CBOR_ENCODING |
                  CapabilityFlags.FIXED_POINT,
    preferred_encoding: 'cbor',
  };
}

export interface HelloAckPayload {
  selected_version: [number, number];
  capabilities: CapabilityFlags;
  engine_version: string;
  contract_version: string;
  hash_version: string;
  cas_version: string;
  session_id: string;
}

export interface Workflow {
  name: string;
  version: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  step_type: 'tool_call' | 'emit_artifact' | 'decision' | 'pause';
  config: Record<string, unknown>;
  depends_on: string[];
}

export interface ExecutionControls {
  max_steps?: number;
  step_timeout_us: FixedDuration;
  run_timeout_us: FixedDuration;
  budget_limit_usd: FixedQ32_32;
  min_step_interval_us: FixedDuration;
}

export const ExecutionControls = {
  default(): ExecutionControls {
    return {
      max_steps: undefined,
      step_timeout_us: Duration.fromSeconds(0),
      run_timeout_us: Duration.fromSeconds(0),
      budget_limit_usd: BigInt(0),
      min_step_interval_us: Duration.fromSeconds(0),
    };
  },
};

export interface Policy {
  rules: PolicyRule[];
  default_decision: Decision;
}

export interface PolicyRule {
  name: string;
  condition: PolicyCondition;
  decision: Decision;
}

export type PolicyCondition =
  | { type: 'capability'; name: string }
  | { type: 'step_limit'; max: number }
  | { type: 'budget_limit'; max_usd: FixedQ32_32 }
  | { type: 'tool_allowed'; tool_name: string }
  | { type: 'and'; conditions: PolicyCondition[] }
  | { type: 'or'; conditions: PolicyCondition[] };

export type Decision =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'prompt' };

export interface ExecRequestPayload {
  run_id: string;
  workflow: Workflow;
  controls: ExecutionControls;
  policy: Policy;
  metadata: Record<string, string>;
}

export interface ExecResultPayload {
  run_id: string;
  status: RunStatus;
  result_digest: string;
  events: RunEvent[];
  final_action?: Action;
  metrics: ExecutionMetrics;
  session_id: string;
}

export type RunStatus =
  | { type: 'completed' }
  | { type: 'paused'; reason: string }
  | { type: 'cancelled'; reason: string }
  | { type: 'failed'; reason: string };

export interface RunEvent {
  event_id: string;
  event_type: string;
  timestamp_us: bigint;
  payload: Record<string, unknown>;
}

export type Action =
  | { type: 'tool_call'; step_id: string; tool_name: string; input: Record<string, unknown> }
  | { type: 'emit_artifact'; step_id: string; artifact_id: string }
  | { type: 'done' };

export interface ExecutionMetrics {
  steps_executed: number;
  elapsed_us: FixedDuration;
  budget_spent_usd: FixedQ32_32;
  throughput: FixedThroughput;
  cas_hit_rate: FixedPpm;
  latency_p50_us: FixedDuration;
  latency_p95_us: FixedDuration;
  latency_p99_us: FixedDuration;
  latency_histogram: Histogram;
}

export interface Histogram {
  boundaries: FixedDuration[];
  counts: bigint[];
}

export interface HealthRequestPayload {
  detailed: boolean;
}

export interface HealthResultPayload {
  status: HealthStatus;
  version: string;
  uptime_us: FixedDuration;
  load?: LoadMetrics;
}

export type HealthStatus =
  | { type: 'healthy' }
  | { type: 'degraded'; reason: string }
  | { type: 'unhealthy'; reason: string };

export interface LoadMetrics {
  active_runs: number;
  queued_runs: number;
  cpu_bps: FixedBps;
  memory_bps: FixedBps;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details: Record<string, string>;
  correlation_id: string;
}

export enum ErrorCode {
  // Protocol errors (1xx)
  InvalidMessage = 100,
  UnsupportedVersion = 101,
  EncodingError = 102,
  
  // Execution errors (2xx)
  ExecutionFailed = 200,
  BudgetExceeded = 201,
  Timeout = 202,
  PolicyDenied = 203,
  
  // System errors (3xx)
  InternalError = 300,
  ResourceExhausted = 301,
  ServiceUnavailable = 302,
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize payload to CBOR (Canonical)
 * Ensures deterministic byte output for binary digests.
 */
export function serializeCbor(payload: unknown): Uint8Array {
  // Use canonical encoding for map key stability (deterministic byte output)
  const encoded = cbor.encodeCanonical(payload);
  return new Uint8Array(encoded);
}

/**
 * Deterministically sort RunEvents by timestamp and ID
 * CRITICAL: Enforced to ensure result_digest stability
 */
export function sortRunEvents(events: RunEvent[]): RunEvent[] {
  return [...events].sort((a, b) => {
    // Primary: Timestamp
    if (a.timestamp_us < b.timestamp_us) return -1;
    if (a.timestamp_us > b.timestamp_us) return 1;
    // Secondary: Event ID (ActionID sorting guard)
    return a.event_id.localeCompare(b.event_id);
  });
}

/**
 * Deserialize payload from CBOR
 */
export function deserializeCbor<T>(data: Uint8Array): T {
  return cbor.decode(data) as T;
}

/**
 * Serialize to JSON (for debugging/fallback)
 */
export function serializeJson(payload: unknown): Uint8Array {
  const json = JSON.stringify(payload, (_, value) => {
    // Convert BigInt to string for JSON
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
  return new TextEncoder().encode(json);
}

/**
 * Deserialize from JSON
 */
export function deserializeJson<T>(data: Uint8Array): T {
  const json = new TextDecoder().decode(data);
  return JSON.parse(json, (_, value) => {
    // Convert string numbers back to BigInt where appropriate
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      try {
        return BigInt(value);
      } catch {
        return value;
      }
    }
    return value;
  });
}
