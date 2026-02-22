/**
 * Core types for the decision engine.
 *
 * These types mirror the Rust types in crates/decision-engine/src/types.rs
 * and MUST remain in sync for parity testing.
 */

// ============================================================================
// Input Types
// ============================================================================

/**
 * An action option in a decision problem.
 */
export interface ActionOption {
  /** Unique identifier for the action */
  id: string;
  /** Human-readable label for the action */
  label: string;
}

/**
 * A scenario in a decision problem.
 */
export interface Scenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Probability of the scenario occurring (0.0 to 1.0). If omitted, all scenarios are treated equally. */
  probability?: number;
  /** Whether this scenario represents an adversarial/worst-case scenario */
  adversarial?: boolean;
}

/**
 * Constraints on the decision problem.
 */
export interface DecisionConstraint {
  /** Maximum acceptable regret */
  maxRegret?: number;
  /** Risk tolerance level (0.0 to 1.0) */
  riskTolerance?: number;
  /** Additional constraints as key-value pairs */
  additional?: Record<string, string>;
}

/**
 * Evidence for the decision problem.
 */
export interface DecisionEvidence {
  /** Drift score (0.0 to 1.0) */
  drift?: number;
  /** Trust score (0.0 to 1.0) */
  trust?: number;
  /** Policy compliance score (0.0 to 1.0) */
  policy?: number;
  /** Provenance information */
  provenance?: string;
}

/**
 * Metadata for the decision (does NOT affect scoring).
 */
export interface DecisionMeta {
  /** Creation timestamp (ISO 8601) */
  createdAt?: string;
  /** Version string */
  version?: string;
  /** Additional metadata */
  additional?: Record<string, string>;
}

/**
 * Input to the decision engine.
 */
export interface DecisionInput {
  /** Optional identifier for the decision */
  id?: string;
  /** Available actions */
  actions: ActionOption[];
  /** Possible scenarios */
  scenarios: Scenario[];
  /** Outcomes as [action_id, scenario_id, utility] tuples */
  outcomes: [string, string, number][];
  /** Optional constraints */
  constraints?: DecisionConstraint;
  /** Optional evidence */
  evidence?: DecisionEvidence;
  /** Optional metadata (does NOT affect scoring) */
  meta?: DecisionMeta;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Weights for composite score calculation.
 */
export interface CompositeWeights {
  /** Weight for worst-case score */
  worstCase: number;
  /** Weight for minimax regret score */
  minimaxRegret: number;
  /** Weight for adversarial robustness score */
  adversarial: number;
}

/**
 * A ranked action with scores.
 */
export interface RankedAction {
  /** Action identifier */
  actionId: string;
  /** Worst-case utility score */
  scoreWorstCase: number;
  /** Maximum regret score */
  scoreMinimaxRegret: number;
  /** Adversarial robustness score */
  scoreAdversarial: number;
  /** Composite score (weighted combination) */
  compositeScore: number;
  /** Whether this action is recommended */
  recommended: boolean;
  /** Rank (1 = best) */
  rank: number;
}

/**
 * Trace of the decision computation for reproducibility.
 */
export interface DecisionTrace {
  /** Utility table: action_id -> scenario_id -> utility */
  utilityTable: Record<string, Record<string, number>>;
  /** Worst-case table: action_id -> minimum utility */
  worstCaseTable: Record<string, number>;
  /** Regret table: action_id -> scenario_id -> regret */
  regretTable: Record<string, Record<string, number>>;
  /** Maximum regret table: action_id -> maximum regret */
  maxRegretTable: Record<string, number>;
  /** Adversarial worst-case table: action_id -> adversarial worst utility */
  adversarialTable: Record<string, number>;
  /** Weights used for composite score */
  compositeWeights: CompositeWeights;
  /** Tie-breaking rule used */
  tieBreakRule: string;
}

/**
 * Output from the decision engine.
 */
export interface DecisionOutput {
  /** Ranked actions (best first) */
  rankedActions: RankedAction[];
  /** SHA-256 fingerprint of the canonical input */
  determinismFingerprint: string;
  /** Trace of the computation */
  trace: DecisionTrace;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes returned by the decision engine.
 */
export type DecisionErrorCode =
  | 'E_SCHEMA'
  | 'E_INVALID_INPUT'
  | 'E_NOT_FOUND'
  | 'E_INTERNAL';

/**
 * Error detail structure.
 */
export interface ErrorDetail {
  /** Error code */
  code: DecisionErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: unknown;
}

/**
 * WASM error response.
 */
export interface WasmErrorResponse {
  ok: false;
  error: ErrorDetail;
}

/**
 * WASM success response.
 */
export interface WasmSuccessResponse<T> {
  ok: true;
  data: T;
}

/**
 * WASM response (success or error).
 */
export type WasmResponse<T> = WasmSuccessResponse<T> | WasmErrorResponse;

// ============================================================================
// Additional Types
// ============================================================================

/**
 * Flip distance for sensitivity analysis.
 */
export interface FlipDistance {
  /** Variable/scenario ID */
  variableId: string;
  /** Distance (magnitude of change) needed to flip the decision */
  flipDistance: number;
  /** The action that would become top if this variable flips */
  newTopAction: string;
}

/**
 * Value of Information ranking.
 */
export interface VoiRanking {
  /** Evidence action ID */
  actionId: string;
  /** Expected value of information */
  evoi: number;
  /** Recommendation: "do_now", "plan_later", or "defer" */
  recommendation: string;
  /** Rationale for the ranking */
  rationale: string[];
}

/**
 * A planned action in a regret-bounded plan.
 */
export interface PlannedAction {
  /** Action ID */
  id: string;
  /** Rationale for including this action */
  rationale: string[];
}

/**
 * A regret-bounded plan.
 */
export interface RegretBoundedPlan {
  /** Plan ID (deterministic hash) */
  id: string;
  /** Decision ID this plan is for */
  decisionId: string;
  /** Planned actions */
  actions: PlannedAction[];
  /** Bounded horizon */
  boundedHorizon: number;
}

/**
 * Decision boundary explanation.
 */
export interface DecisionBoundary {
  /** Current top action */
  topAction: string;
  /** Nearest flip distances */
  nearestFlips: FlipDistance[];
}

/**
 * Referee adjudication result.
 */
export interface RefereeAdjudication {
  /** Whether the proposal was accepted */
  accepted: boolean;
  /** The agent's claim */
  agentClaim?: string;
  /** The computed decision boundary */
  boundary: DecisionBoundary;
  /** What would need to change for acceptance */
  whatWouldChange: string[];
}

/**
 * Engine version info.
 */
export interface EngineVersion {
  /** Version string */
  version: string;
}

/**
 * Fingerprint result.
 */
export interface FingerprintResult {
  /** SHA-256 fingerprint (64 hex characters) */
  fingerprint: string;
}

/**
 * Result with engine metadata.
 */
export interface DecisionResult extends DecisionOutput {
  /** Engine that produced this result ("wasm" or "fallback") */
  engine: 'wasm' | 'fallback';
  /** Engine version */
  engineVersion: string;
}
