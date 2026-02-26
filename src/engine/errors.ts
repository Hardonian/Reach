/**
 * Engine Error Handling
 * 
 * Provides structured error mapping between engines and Reach CLI.
 * Ensures no secret leakage in error messages.
 * 
 * @module engine/errors
 */

import { EngineError, EngineErrorCode } from './contract';

/**
 * Error codes that indicate engine unavailability (trigger fallback)
 */
export const FALLBACK_ERROR_CODES: EngineErrorCode[] = [
  'E_ENGINE_UNHEALTHY',
  'E_HASH_UNAVAILABLE',
  'E_CAS_UNAVAILABLE',
  'E_TIMEOUT',
];

/**
 * Error codes that should never be retried
 */
export const NON_RETRYABLE_CODES: EngineErrorCode[] = [
  'E_SCHEMA',
  'E_INVALID_INPUT',
  'E_POLICY_DENIED',
  'E_SANDBOX_VIOLATION',
  'E_NOT_IMPLEMENTED',
];

/**
 * Create a structured engine error
 */
export function createEngineError(
  code: EngineErrorCode,
  message: string,
  details?: Record<string, unknown>,
): EngineError {
  return {
    code,
    message: sanitizeErrorMessage(message),
    details: details ? sanitizeDetails(details) : undefined,
    retryable: !NON_RETRYABLE_CODES.includes(code),
  };
}

/**
 * Sanitize error message to prevent secret leakage
 * - Removes file paths that might contain usernames
 * - Redacts potential secrets
 * - Limits message length
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error';
  
  let sanitized = message;
  
  // Redact potential secrets (keys, tokens, passwords)
  sanitized = sanitized.replace(/\b([a-zA-Z0-9_-]*)(key|token|secret|password|credential)s?[=:]\s*\S+/gi, '$1$2=***REDACTED***');
  
  // Redact file paths (Unix and Windows)
  sanitized = sanitized.replace(/\/(home|Users)\/[^/\s]+/gi, '/.../REDACTED');
  sanitized = sanitized.replace(/C:\\[^\\\s]+\\[^\\\s]+/gi, 'C:\\...\\REDACTED');
  
  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...';
  }
  
  return sanitized;
}

/**
 * Sanitize error details object
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(details)) {
    // Skip sensitive keys
    if (isSensitiveKey(key)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Check if a key indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /credential/i,
    /auth/i,
    /private/i,
    /apikey/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
}

/**
 * Map raw engine errors to structured error codes
 */
export function mapEngineError(rawError: unknown): EngineError {
  if (rawError instanceof Error) {
    const message = rawError.message;
    
    // Map known error patterns to codes
    if (message.includes('E_SCHEMA') || message.includes('Invalid input JSON')) {
      return createEngineError('E_SCHEMA', message);
    }
    if (message.includes('E_INVALID_INPUT') || message.includes('validation')) {
      return createEngineError('E_INVALID_INPUT', message);
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return createEngineError('E_TIMEOUT', 'Execution timed out');
    }
    if (message.includes('hash') || message.includes('fingerprint')) {
      return createEngineError('E_HASH_UNAVAILABLE', 'Hash computation failed');
    }
    if (message.includes('policy') || message.includes('denied')) {
      return createEngineError('E_POLICY_DENIED', 'Execution denied by policy');
    }
    
    return createEngineError('E_INTERNAL', message);
  }
  
  return createEngineError('E_INTERNAL', String(rawError) || 'Unknown error');
}

/**
 * Format error for CLI output (user-facing)
 */
export function formatErrorForCli(error: EngineError, debug = false): string {
  const parts: string[] = [];
  
  parts.push(`Error [${error.code}]: ${error.message}`);
  
  if (debug && error.details) {
    parts.push(`Details: ${JSON.stringify(error.details, null, 2)}`);
  }
  
  if (error.retryable) {
    parts.push('This error is retryable.');
  }
  
  return parts.join('\n');
}

/**
 * Check if error should trigger fallback to another engine
 */
export function shouldTriggerFallback(error: EngineError): boolean {
  return FALLBACK_ERROR_CODES.includes(error.code);
}

/**
 * EngineError class for throwing
 */
export class EngineErrorException extends Error {
  public readonly code: EngineErrorCode;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;
  
  constructor(error: EngineError) {
    super(error.message);
    this.name = 'EngineErrorException';
    this.code = error.code;
    this.retryable = error.retryable;
    this.details = error.details;
  }
}
