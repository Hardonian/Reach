/**
 * Engine Contract Types
 * 
 * Defines the canonical request/response types for the Reach decision engine.
 * These types are used across all engine adapters.
 * 
 * @module engine/contract
 */

/**
 * Supported algorithm types for decision evaluation
 */
export type ExecutionAlgorithm = 
  | 'minimax_regret'
  | 'maximin'
  | 'weighted_sum'
  | 'adaptive';
  | 'adaptive';

/**
 * Execution parameters for a decision request
 */
export interface ExecutionParams {
  algorithm: ExecutionAlgorithm;
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  weights?: Record<string, number>;
  strict?: boolean;
  temperature?: number;
  optimism?: number;
  confidence?: number;
  iterations?: number;
  epsilon?: number;
}

/**
 * A canonical execution request to the decision engine
 */
export interface ExecRequest {
  requestId: string;
  timestamp: string;
  params: ExecutionParams;
}

/**
 * Execution trace containing algorithm-specific details
 */
export interface ExecutionTrace {
  algorithm: string;
  regretTable?: Record<string, Record<string, number>>;
  maxRegret?: Record<string, number>;
  minUtility?: Record<string, number>;
  weightedScores?: Record<string, number>;
}

/**
 * Engine metadata about the execution
 */
export interface EngineMeta {
  engine: string;
  engineVersion: string;
  durationMs: number;
  completedAt: string;
}

/**
 * A canonical execution result from the decision engine
 */
export interface ExecResult {
  requestId: string;
  status: 'success' | 'error' | 'timeout';
  recommendedAction: string;
  ranking: string[];
  trace: ExecutionTrace;
  fingerprint: string;
  meta: EngineMeta;
  error?: string;
}

/**
 * Engine type identifiers
 */
export type EngineType = 'ts' | 'wasm' | 'requiem' | 'dual';

/**
 * Engine configuration options
 */
export interface EngineConfig {
  type: EngineType;
  timeout?: number;
  retries?: number;
}
