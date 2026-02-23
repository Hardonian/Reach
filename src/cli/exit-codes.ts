/**
 * Standard exit codes for Reach CLI commands
 * 
 * These codes are used consistently across all Reach CLI commands
 * to enable proper scripting and error handling.
 */

export const exitCodes = {
  /** Success (0) - Command completed successfully */
  SUCCESS: 0,
  
  /** Generic failure (1) - Unspecified error occurred */
  GENERIC_FAILURE: 1,
  
  /** Invalid input/usage (2) - Bad arguments or invalid command usage */
  INVALID_INPUT: 2,
  
  /** Not found (3) - Requested resource not found */
  NOT_FOUND: 3,
  
  /** Policy blocked (4) - Decision/policy blocked the operation */
  POLICY_BLOCKED: 4,
  
  /** Verification failed (5) - Integrity/verification check failed */
  VERIFICATION_FAILED: 5,
} as const

export type ExitCode = typeof exitCodes[keyof typeof exitCodes]

/**
 * Get a human-readable description for an exit code
 */
export function getExitCodeDescription(code: number): string {
  switch (code) {
    case exitCodes.SUCCESS:
      return 'Success'
    case exitCodes.GENERIC_FAILURE:
      return 'Generic failure'
    case exitCodes.INVALID_INPUT:
      return 'Invalid input or usage'
    case exitCodes.NOT_FOUND:
      return 'Resource not found'
    case exitCodes.POLICY_BLOCKED:
      return 'Operation blocked by policy'
    case exitCodes.VERIFICATION_FAILED:
      return 'Verification failed'
    default:
      return `Unknown exit code: ${code}`
  }
}
