/**
 * Protocol Message Types (TypeScript)
 *
 * TypeScript equivalents of the Rust message payloads.
 * Uses CBOR for serialization with fixed-point numeric types.
 */

import { encode as cborEncode, decode as cborDecode } from 'cbor';

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

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message envelope - all protocol messages are wrapped in this
 */
export interface Envelope {
  version: number;
  sequence: number;
  timestamp: number; // Unix timestamp in ms
  payload: Payload;
}

export type Payload =
  | { type: 'hello'; data: Hello }
  | { type: 'hello_ack'; data: HelloAck }
  | { type: 'ping'; data: Ping }
  | { type: 'pong'; data: Pong }
  | { type: 'execute'; data: ExecRequestPayload }
  | { type: 'result'; data: ExecResultPayload }
  | { type: 'error'; data: ErrorResult }
  | { type: 'status'; data: StatusRequest }
  | { type: 'status_result'; data: StatusResult };

export interface Hello {
  client_version: string;
  protocol_version: number;
  capabilities: string[];
}

export interface HelloAck {
  server_version: string;
  protocol_version: number;
  capabilities: string[];
}

export interface Ping {
  nonce: number;
}

export interface Pong {
  nonce: number;
  timestamp: number;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface Policy {
  id: string;
  version: string;
  rules: unknown[];
}

export interface Decision {
  id: string;
  action: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  decision: Decision;
  dependencies: string[];
}

export interface Workflow {
  id: string;
  steps: WorkflowStep[];
}

export interface ExecRequestPayload {
  run_id: string;
  pack_id: string;
  workflow?: Workflow;
  decision?: Decision;
  params: Record<string, unknown>;
  policy?: Policy;
  controls?: ExecutionControls;
}

export interface ExecutionMetrics {
  cpu_time_ms: number;
  memory_peak_bytes: number;
  io_read_bytes: number;
  io_write_bytes: number;
}

export interface ExecResultPayload {
  run_id: string;
  success: boolean;
  result?: unknown;
  fingerprint: string;
  execution_time_ms: number;
  metrics?: ExecutionMetrics;
}

export interface ErrorResult {
  run_id: string;
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

export type ErrorCode =
  | 'E_INVALID_INPUT'
  | 'E_POLICY_VIOLATION'
  | 'E_EXECUTION_FAILED'
  | 'E_TIMEOUT'
  | 'E_INTERNAL'
  | 'E_RESOURCE_EXHAUSTED'
  | 'E_DETERMINISM_FAILED'
  | 'E_PROTOCOL_MISMATCH';

export interface StatusRequest {
  run_id?: string;
}

export interface StatusResult {
  ready: boolean;
  version: string;
  queued_runs: number;
  active_runs: number;
}

// ============================================================================
// Execution Controls
// ============================================================================

/**
 * Duration specification - can be millis or human-readable
 */
export type Duration = number | string;

/**
 * Execution controls for fine-tuning behavior
 */
export interface ExecutionControls {
  /**
   * Maximum execution time
   */
  timeout?: Duration;

  /**
   * Maximum memory usage in bytes
   */
  memory_limit?: number;

  /**
   * Priority level (lower = higher priority)
   */
  priority?: number;

  /**
   * Whether execution can be retried on failure
   */
  retryable?: boolean;

  /**
   * Maximum number of retries
   */
  max_retries?: number;

  /**
   * Enable detailed tracing
   */
  trace?: boolean;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize an envelope to CBOR bytes
 */
export function serialize(envelope: Envelope): Buffer {
  return cborEncode(envelope);
}

/**
 * Deserialize CBOR bytes to an envelope
 */
export function deserialize(data: Buffer): Envelope {
  return cborDecode(data) as Envelope;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a hello message
 */
export function createHello(
  sequence: number,
  clientVersion: string,
  protocolVersion: number,
  capabilities: string[] = []
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'hello',
      data: {
        client_version: clientVersion,
        protocol_version: protocolVersion,
        capabilities,
      },
    },
  };
}

/**
 * Create a hello acknowledgment
 */
export function createHelloAck(
  sequence: number,
  serverVersion: string,
  protocolVersion: number,
  capabilities: string[] = []
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'hello_ack',
      data: {
        server_version: serverVersion,
        protocol_version: protocolVersion,
        capabilities,
      },
    },
  };
}

/**
 * Create a ping message
 */
export function createPing(sequence: number, nonce: number): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: { type: 'ping', data: { nonce } },
  };
}

/**
 * Create a pong response
 */
export function createPong(sequence: number, nonce: number): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: { type: 'pong', data: { nonce, timestamp: Date.now() } },
  };
}

/**
 * Create an execute request
 */
export function createExecute(
  sequence: number,
  run_id: string,
  pack_id: string,
  params: Record<string, unknown>,
  policy?: Policy,
  workflow?: Workflow,
  decision?: Decision,
  controls?: ExecutionControls
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'execute',
      data: { run_id, pack_id, params, policy, workflow, decision, controls },
    },
  };
}

/**
 * Create an execute result
 */
export function createResult(
  sequence: number,
  run_id: string,
  success: boolean,
  result: unknown,
  fingerprint: string,
  execution_time_ms: number,
  metrics?: ExecutionMetrics
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'result',
      data: { run_id, success, result, fingerprint, execution_time_ms, metrics },
    },
  };
}

/**
 * Create an error result
 */
export function createError(
  sequence: number,
  run_id: string,
  code: ErrorCode,
  message: string,
  recoverable: boolean
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'error',
      data: { run_id, code, message, recoverable },
    },
  };
}

/**
 * Create a status request
 */
export function createStatusRequest(sequence: number, run_id?: string): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: { type: 'status', data: { run_id } },
  };
}

/**
 * Create a status result
 */
export function createStatusResult(
  sequence: number,
  ready: boolean,
  version: string,
  queued_runs: number,
  active_runs: number
): Envelope {
  return {
    version: 1,
    sequence,
    timestamp: Date.now(),
    payload: {
      type: 'status_result',
      data: { ready, version, queued_runs, active_runs },
    },
  };
}
