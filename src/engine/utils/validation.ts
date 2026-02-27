/**
 * Validation Utilities
 * Shared validation logic for engine adapters
 */

/**
 * Check for floating point values in object tree
 * Ensures numeric integrity for fixed-point arithmetic
 */
export function hasFloatingPointValues(obj: unknown): boolean {
  if (typeof obj === 'number') {
    return !Number.isInteger(obj);
  }
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (hasFloatingPointValues(item)) {
          return true;
        }
      }
    } else {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (hasFloatingPointValues(value)) {
          return true;
        }
      }
    }
  }
  return false;
}
