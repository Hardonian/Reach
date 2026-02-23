/**
 * Reach Protocol Schemas Index
 * 
 * This file aggregates all JSON schemas used in the Reach system.
 * Each schema defines the structure for different types of data
 * used across CLI, API, and engine components.
 */

export { default as cliOutputSchema } from './cli-output.schema.json';
export { default as junctionSchema } from './junction.schema.json';
export { default as decisionSchema } from './decision.schema.json';
export { default as actionSchema } from './action.schema.json';
export { default as eventSchema } from './event.schema.json';
export { default as vitalsSchema } from './vitals.schema.json';
export { default as bundleSchema } from './bundle.schema.json';
export { default as evidenceSchema } from './evidence.schema.json';

// Schema version - update when making breaking changes
export const SCHEMA_VERSION = '1.0.0';

// Engine version - matches package.json version
export const ENGINE_VERSION = '0.1.0';

/**
 * Creates a standard CLI output wrapper
 */
export function createSuccessResponse<T>(data: T) {
  return {
    ok: true,
    data,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}

/**
 * Creates a standard CLI error response
 */
export function createErrorResponse(code: string, message: string, details?: Record<string, unknown>) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}
