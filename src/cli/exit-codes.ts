/**
 * Standard exit codes for Reach CLI commands
 *
 * These codes are used consistently across all Reach CLI commands
 * to enable proper scripting and error handling.
 *
 * @deprecated Use ErrorCodes from '../core/errors.js' instead. This file is kept for backwards compatibility.
 */

export {
  ErrorCodes as exitCodes,
  type ErrorCode as ExitCode,
  getErrorCodeDescription,
} from "../core/errors.js";
