/**
 * Reach Engine Error Types
 * 
 * Standardized error codes for clear operator communication and
 * programmatic error handling across the engine boundary.
 * 
 * @module engine/errors
 */

/**
 * Standard error codes for Reach engine operations
 */
export enum ReachErrorCode {
  // Engine selection/mismatch errors
  ENGINE_MISMATCH = 'mismatch',
  ENGINE_UNAVAILABLE = 'engine_unavailable',
  ENGINE_TIMEOUT = 'engine_timeout',
  
  // Queue/resource exhaustion
  QUEUE_FULL = 'queue_full',
  RATE_LIMITED = 'rate_limited',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  
  // Policy violations
  POLICY_VIOLATION = 'policy_violation',
  POLICY_DENY = 'policy_deny',
  UNAUTHORIZED = 'unauthorized',
  
  // Integrity errors
  CAS_INTEGRITY = 'cas_integrity',
  HASH_MISMATCH = 'hash_mismatch',
  FINGERPRINT_MISMATCH = 'fingerprint_mismatch',
  
  // Sandbox/security errors
  SANDBOX_ESCAPE = 'sandbox_escape',
  SECRET_EXFILTRATION = 'secret_exfiltration',
  BINARY_UNTRUSTED = 'binary_untrusted',
  
  // Input validation
  INVALID_INPUT = 'invalid_input',
  REQUEST_TOO_LARGE = 'request_too_large',
  MATRIX_TOO_LARGE = 'matrix_too_large',
  
  // Protocol errors
  PROTOCOL_ERROR = 'protocol_error',
  SERIALIZATION_ERROR = 'serialization_error',
  DESERIALIZATION_ERROR = 'deserialization_error',
  
  // Internal errors
  INTERNAL_ERROR = 'internal_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Rich error context for debugging and operator visibility
 */
export interface ErrorContext {
  /** The request ID that triggered the error */
  requestId?: string;
  /** The engine that was active when the error occurred */
  engine?: string;
  /** Timestamp of the error */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Rollback command if applicable */
  rollbackCommand?: string;
  /** Suggested remediation */
  remediation?: string;
}

/**
 * Structured error class for Reach engine
 */
export class ReachError extends Error {
  readonly code: ReachErrorCode;
  readonly severity: ErrorSeverity;
  readonly context: ErrorContext;
  readonly isRetryable: boolean;

  constructor(
    code: ReachErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: Partial<ErrorContext>;
      isRetryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'ReachError';
    this.code = code;
    this.severity = options.severity ?? ErrorSeverity.ERROR;
    this.isRetryable = options.isRetryable ?? this.computeRetryable(code);
    this.context = {
      timestamp: new Date().toISOString(),
      ...options.context,
    };
  }

  /**
   * Format error for CLI output
   */
  formatForCli(): string {
    const lines: string[] = [];
    lines.push(`Error [${this.code}]: ${this.message}`);
    
    if (this.context.requestId) {
      lines.push(`  Request ID: ${this.context.requestId}`);
    }
    if (this.context.engine) {
      lines.push(`  Engine: ${this.context.engine}`);
    }
    if (this.context.rollbackCommand) {
      lines.push(`  Rollback: ${this.context.rollbackCommand}`);
    }
    if (this.context.remediation) {
      lines.push(`  Remediation: ${this.context.remediation}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format error for JSON output
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        severity: this.severity,
        isRetryable: this.isRetryable,
        context: this.context,
      },
    };
  }

  private computeRetryable(code: ReachErrorCode): boolean {
    switch (code) {
      case ReachErrorCode.QUEUE_FULL:
      case ReachErrorCode.RATE_LIMITED:
      case ReachErrorCode.ENGINE_TIMEOUT:
      case ReachErrorCode.ENGINE_UNAVAILABLE:
        return true;
      case ReachErrorCode.POLICY_VIOLATION:
      case ReachErrorCode.CAS_INTEGRITY:
      case ReachErrorCode.SANDBOX_ESCAPE:
      case ReachErrorCode.INVALID_INPUT:
        return false;
      default:
        return false;
    }
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export function createMismatchError(
  expected: string,
  actual: string,
  context?: Partial<ErrorContext>
): ReachError {
  return new ReachError(
    ReachErrorCode.ENGINE_MISMATCH,
    `Engine mismatch: expected ${expected}, got ${actual}`,
    {
      severity: ErrorSeverity.CRITICAL,
      context: {
        ...context,
        metadata: {
          ...context?.metadata,
          expected,
          actual,
        },
      },
      isRetryable: false,
    }
  );
}

export function createQueueFullError(
  queueSize: number,
  maxSize: number,
  context?: Partial<ErrorContext>
): ReachError {
  return new ReachError(
    ReachErrorCode.QUEUE_FULL,
    `Request queue full (${queueSize}/${maxSize}). Consider increasing queue capacity or reducing request rate.`,
    {
      severity: ErrorSeverity.WARNING,
      context: {
        ...context,
        metadata: {
          ...context?.metadata,
          queueSize,
          maxSize,
        },
      },
      isRetryable: true,
    }
  );
}

export function createPolicyViolationError(
  rule: string,
  details?: string,
  context?: Partial<ErrorContext>
): ReachError {
  return new ReachError(
    ReachErrorCode.POLICY_VIOLATION,
    `Policy violation: ${rule}${details ? ` - ${details}` : ''}`,
    {
      severity: ErrorSeverity.ERROR,
      context: {
        ...context,
        metadata: {
          ...context?.metadata,
          rule,
          details,
        },
      },
      isRetryable: false,
    }
  );
}

export function createCasIntegrityError(
  expectedHash: string,
  actualHash: string,
  context?: Partial<ErrorContext>
): ReachError {
  return new ReachError(
    ReachErrorCode.CAS_INTEGRITY,
    `CAS integrity check failed: hash mismatch`,
    {
      severity: ErrorSeverity.CRITICAL,
      context: {
        ...context,
        metadata: {
          ...context?.metadata,
          expectedHash: expectedHash.slice(0, 16) + '...',
          actualHash: actualHash.slice(0, 16) + '...',
        },
      },
      isRetryable: false,
    }
  );
}

export function createSandboxEscapeError(
  attempt: string,
  context?: Partial<ErrorContext>
): ReachError {
  return new ReachError(
    ReachErrorCode.SANDBOX_ESCAPE,
    `Sandbox escape attempt detected: ${attempt}`,
    {
      severity: ErrorSeverity.CRITICAL,
      context: {
        ...context,
        metadata: {
          ...context?.metadata,
          attempt,
        },
      },
      isRetryable: false,
    }
  );
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if an error is a ReachError
 */
export function isReachError(error: unknown): error is ReachError {
  return error instanceof ReachError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isReachError(error)) {
    return error.isRetryable;
  }
  // For unknown errors, be conservative
  return false;
}

/**
 * Convert unknown error to ReachError
 */
export function toReachError(error: unknown): ReachError {
  if (isReachError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ReachError(
      ReachErrorCode.UNKNOWN_ERROR,
      error.message,
      {
        severity: ErrorSeverity.ERROR,
        cause: error,
      }
    );
  }
  
  return new ReachError(
    ReachErrorCode.UNKNOWN_ERROR,
    String(error),
    {
      severity: ErrorSeverity.ERROR,
    }
  );
}
