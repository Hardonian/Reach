/**
 * Reach Core Error Types
 *
 * Standardized error types and utilities for consistent error handling
 * across the Reach codebase.
 */

/** Standardized error codes for Reach operations */
export const ErrorCodes = {
  // Success (0)
  SUCCESS: 0,

  // Generic failures (1-9)
  GENERIC_FAILURE: 1,
  INVALID_INPUT: 2,
  NOT_FOUND: 3,
  POLICY_BLOCKED: 4,
  VERIFICATION_FAILED: 5,
  CONFIG_INVALID: 6,
  TIMEOUT: 7,
  UNAVAILABLE: 8,

  // LLM/Provider errors (10-19)
  LLM_PROVIDER_UNREACHABLE: 10,
  LLM_MODEL_UNAVAILABLE: 11,
  LLM_NON_DETERMINISTIC: 12,
  LLM_API_ERROR: 13,

  // Replay errors (20-29)
  REPLAY_DATASET_INVALID: 20,
  REPLAY_CASE_FAILED: 21,
  REPLAY_MISMATCH: 22,
  REPLAY_BUDGET_EXCEEDED: 23,

  // Determinism errors (30-39)
  DETERMINISM_VIOLATION: 30,
  HASH_MISMATCH: 31,

  // IO/FS errors (40-49)
  FILE_NOT_FOUND: 40,
  FILE_READ_ERROR: 41,
  FILE_WRITE_ERROR: 42,
  PERMISSION_DENIED: 43,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Get human-readable description for an error code */
export function getErrorCodeDescription(code: ErrorCode): string {
  const descriptions: Record<ErrorCode, string> = {
    [ErrorCodes.SUCCESS]: "Success",
    [ErrorCodes.GENERIC_FAILURE]: "Generic failure",
    [ErrorCodes.INVALID_INPUT]: "Invalid input or usage",
    [ErrorCodes.NOT_FOUND]: "Resource not found",
    [ErrorCodes.POLICY_BLOCKED]: "Operation blocked by policy",
    [ErrorCodes.VERIFICATION_FAILED]: "Verification failed",
    [ErrorCodes.CONFIG_INVALID]: "Invalid configuration",
    [ErrorCodes.TIMEOUT]: "Operation timed out",
    [ErrorCodes.UNAVAILABLE]: "Service unavailable",
    [ErrorCodes.LLM_PROVIDER_UNREACHABLE]: "LLM provider unreachable",
    [ErrorCodes.LLM_MODEL_UNAVAILABLE]: "LLM model unavailable",
    [ErrorCodes.LLM_NON_DETERMINISTIC]: "Non-deterministic LLM configuration",
    [ErrorCodes.LLM_API_ERROR]: "LLM API error",
    [ErrorCodes.REPLAY_DATASET_INVALID]: "Invalid replay dataset",
    [ErrorCodes.REPLAY_CASE_FAILED]: "Replay case failed",
    [ErrorCodes.REPLAY_MISMATCH]: "Replay output mismatch",
    [ErrorCodes.REPLAY_BUDGET_EXCEEDED]: "Replay budget exceeded",
    [ErrorCodes.DETERMINISM_VIOLATION]: "Determinism violation detected",
    [ErrorCodes.HASH_MISMATCH]: "Hash mismatch",
    [ErrorCodes.FILE_NOT_FOUND]: "File not found",
    [ErrorCodes.FILE_READ_ERROR]: "File read error",
    [ErrorCodes.FILE_WRITE_ERROR]: "File write error",
    [ErrorCodes.PERMISSION_DENIED]: "Permission denied",
  };
  return descriptions[code] ?? `Unknown error code: ${code}`;
}

/** Structured error with code and context */
export class ReachError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(message);
    this.name = "ReachError";
    this.code = code;
    this.context = options?.context;
    this.cause = options?.cause;
  }

  /** Format error for CLI output */
  toCLIString(): string {
    const parts = [`[ERROR ${this.code}] ${this.message}`];
    if (this.context && Object.keys(this.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
    }
    if (this.cause) {
      parts.push(`Caused by: ${this.cause.message}`);
    }
    return parts.join("\n");
  }
}

/** Ensure any thrown value is converted to a ReachError */
export function toReachError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCodes.GENERIC_FAILURE,
): ReachError {
  if (error instanceof ReachError) return error;
  if (error instanceof Error) {
    return new ReachError(defaultCode, error.message, { cause: error });
  }
  return new ReachError(defaultCode, String(error));
}

/** Exit process with standardized error code */
export function exitWithError(code: ErrorCode, message?: string): never {
  if (message) {
    console.error(`[EXIT ${code}] ${message}`);
  }
  process.exit(code);
}

/** Safe wrapper for async operations that ensures no uncaught exceptions */
export async function safeRun<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode,
  errorMessage: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toReachError(error, errorCode);
  }
}
