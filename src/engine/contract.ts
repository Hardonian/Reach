/**
 * Engine Contract
 * 
 * Defines the canonical request/response interfaces for all execution engines.
 * This contract ensures compatibility between Reach CLI and multiple engine
 * implementations (Rust, Requiem C++, TypeScript fallback).
 * 
 * @module engine/contract
 */

// ============================================================================
// Core Engine Types
// ============================================================================

export type EngineType = 'rust' | 'requiem' | 'ts' | 'dual';

export interface EngineCapabilities {
  /** Engine supports deterministic hashing */
  deterministicHashing: boolean;
  /** Engine supports CAS (Content Addressable Storage) */
  casSupport: boolean;
  /** Engine supports replay validation */
  replayValidation: boolean;
  /** Engine supports sandboxed execution */
  sandboxing: boolean;
  /** Engine supports Windows platform */
  windowsSupport: boolean;
  /** Engine supports daemon mode */
  daemonMode: boolean;
  /** Engine version string */
  version: string;
}

export interface EngineHealth {
  /** Whether the engine is healthy and available */
  healthy: boolean;
  /** Engine type */
  engine: EngineType;
  /** Engine version */
  version: string;
  /** Last error message if unhealthy */
  lastError?: string;
  /** Timestamp of health check */
  checkedAt: string;
}

// ============================================================================
// Execution Request/Response
// ============================================================================

export interface ExecRequest {
  /** Unique request ID for tracing */
  requestId: string;
  /** Request timestamp (ISO 8601) */
  timestamp: string;
  /** Execution parameters */
  params: ExecutionParams;
  /** Policy configuration */
  policy?: PolicyConfig;
  /** Artifact references */
  artifacts?: ArtifactRef[];
  /** Replay context (for replay operations) */
  replayContext?: ReplayContext;
}

export interface ExecutionParams {
  /** Algorithm to use */
  algorithm: 'minimax_regret' | 'maximin' | 'weighted_sum' | 'adaptive';
  /** Actions to evaluate */
  actions: string[];
  /** States/scenarios to consider */
  states: string[];
  /** Outcome matrix: action -> state -> utility */
  outcomes: Record<string, Record<string, number>>;
  /** Optional weights for weighted_sum algorithm */
  weights?: Record<string, number>;
  /** Strict mode validation */
  strict?: boolean;
  /** Temperature for adaptive algorithms */
  temperature?: number;
  /** Optimism factor (0-1) */
  optimism?: number;
  /** Confidence threshold */
  confidence?: number;
  /** Max iterations for iterative algorithms */
  iterations?: number;
  /** Convergence epsilon */
  epsilon?: number;
}

export interface PolicyConfig {
  /** Policy ID */
  id: string;
  /** Policy version */
  version: string;
  /** Policy rules (RegO or JSON) */
  rules: string;
  /** Policy gates to evaluate */
  gates?: string[];
}

export interface ArtifactRef {
  /** Artifact CID (Content Identifier) */
  cid: string;
  /** Artifact URI */
  uri: string;
  /** Artifact hash for verification */
  hash?: string;
}

export interface ReplayContext {
  /** Original run ID */
  originalRunId: string;
  /** Event log to replay */
  eventLog: ReplayEvent[];
  /** Expected fingerprint */
  expectedFingerprint?: string;
}

export interface ReplayEvent {
  /** Event sequence number */
  seq: number;
  /** Event type */
  type: string;
  /** Event payload */
  payload: unknown;
  /** Event timestamp */
  timestamp: string;
}

// ============================================================================
// Execution Response
// ============================================================================

export interface ExecResult {
  /** Request ID (matches request) */
  requestId: string;
  /** Execution status */
  status: 'success' | 'failure' | 'partial';
  /** Recommended action */
  recommendedAction: string;
  /** Ranked list of actions */
  ranking: string[];
  /** Execution trace */
  trace: ExecutionTrace;
  /** Result fingerprint (deterministic hash) */
  fingerprint: string;
  /** Execution metadata */
  meta: ExecutionMeta;
  /** Error information (if status is failure) */
  error?: EngineError;
}

export interface ExecutionTrace {
  /** Algorithm used */
  algorithm: string;
  /** Regret table (for minimax_regret) */
  regretTable?: Record<string, Record<string, number>>;
  /** Max regret per action */
  maxRegret?: Record<string, number>;
  /** Min utility per action (for maximin) */
  minUtility?: Record<string, number>;
  /** Weighted scores (for weighted_sum) */
  weightedScores?: Record<string, number>;
  /** Algorithm-specific scores */
  scores?: Record<string, Record<string, number>>;
}

export interface ExecutionMeta {
  /** Engine type that produced result */
  engine: EngineType;
  /** Engine version */
  engineVersion: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Timestamp of completion */
  completedAt: string;
}

export interface EngineError {
  /** Error code */
  code: EngineErrorCode;
  /** Human-readable message */
  message: string;
  /** Error details (safe for logging) */
  details?: Record<string, unknown>;
  /** Whether error is retryable */
  retryable: boolean;
}

export type EngineErrorCode =
  | 'E_SCHEMA'           // Invalid input schema
  | 'E_INVALID_INPUT'    // Input validation failed
  | 'E_INTERNAL'         // Internal engine error
  | 'E_TIMEOUT'          // Execution timeout
  | 'E_POLICY_DENIED'    // Policy denied execution
  | 'E_CAS_UNAVAILABLE'  // CAS backend unavailable
  | 'E_HASH_UNAVAILABLE' // Hash computation failed
  | 'E_REPLAY_MISMATCH'  // Replay fingerprint mismatch
  | 'E_SANDBOX_VIOLATION'// Sandbox violation detected
  | 'E_ENGINE_UNHEALTHY' // Engine unhealthy
  | 'E_NOT_IMPLEMENTED'; // Feature not implemented

// ============================================================================
// Dual-Run Comparison
// ============================================================================

export interface DualRunResult {
  /** Primary result (from selected engine) */
  primary: ExecResult;
  /** Secondary result (from comparison engine) */
  secondary?: ExecResult;
  /** Comparison analysis */
  comparison?: EngineComparison;
  /** Path to diff report */
  diffReportPath?: string;
}

export interface EngineComparison {
  /** Whether results match */
  match: boolean;
  /** Severity of any mismatch */
  severity: 'none' | 'minor' | 'major' | 'critical';
  /** Differences found */
  differences: EngineDifference[];
}

export interface EngineDifference {
  /** Field that differs */
  field: string;
  /** Primary value */
  primary: unknown;
  /** Secondary value */
  secondary: unknown;
  /** Difference type */
  type: 'value' | 'missing' | 'extra';
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface EngineAdapter {
  /** Adapter name */
  readonly name: string;
  
  /** Engine type */
  readonly engineType: string;
  
  /**
   * Execute a decision request
   */
  execute(request: ExecRequest): Promise<ExecResult>;
  
  /**
   * Check engine health
   */
  health(): Promise<EngineHealth>;
  
  /**
   * Get engine capabilities
   */
  capabilities(): Promise<EngineCapabilities>;
  
  /**
   * Get engine version
   */
  version(): Promise<string>;
  
  /**
   * Initialize the adapter (optional)
   */
  initialize?(): Promise<void>;
  
  /**
   * Shutdown the adapter (optional)
   */
  shutdown?(): Promise<void>;
}

export interface EngineConfig {
  /** Default engine to use */
  defaultEngine: EngineType;
  /** Whether to enable auto-fallback on error */
  autoFallback: boolean;
  /** Dual-run sampling rate (0-1) */
  dualSampleRate: number;
  /** Whether to fail on dual-run mismatch */
  dualFailOnMismatch: boolean;
  /** Path to Requiem binary */
  requiemBin?: string;
  /** Daemon mode configuration */
  daemon?: DaemonConfig;
  /** Timeout configuration */
  timeouts: TimeoutConfig;
  /** Rollback configuration */
  rollback: RollbackConfig;
}

export interface DaemonConfig {
  /** Enable daemon mode */
  enabled: boolean;
  /** Socket path (Unix) or pipe name (Windows) */
  socketPath?: string;
  /** TCP port (if using TCP) */
  port?: number;
  /** Host (if using TCP) */
  host?: string;
  /** Auto-start daemon if not running */
  autoStart: boolean;
}

export interface TimeoutConfig {
  /** Default execution timeout (ms) */
  defaultMs: number;
  /** Health check timeout (ms) */
  healthCheckMs: number;
  /** Daemon startup timeout (ms) */
  daemonStartupMs: number;
}

export interface RollbackConfig {
  /** Environment variable to force rollback */
  forceEnvVar: string;
  /** Error codes that trigger automatic rollback */
  autoRollbackCodes: EngineErrorCode[];
  /** Whether to emit warning on rollback */
  warnOnRollback: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  defaultEngine: 'requiem',
  autoFallback: true,
  dualSampleRate: 0.0, // Disabled by default
  dualFailOnMismatch: false,
  timeouts: {
    defaultMs: 30000,
    healthCheckMs: 5000,
    daemonStartupMs: 10000,
  },
  rollback: {
    forceEnvVar: 'REACH_ENGINE_FORCE_RUST',
    autoRollbackCodes: ['E_ENGINE_UNHEALTHY', 'E_HASH_UNAVAILABLE'],
    warnOnRollback: true,
  },
};
