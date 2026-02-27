/**
 * Hash utility module
 *
 * Re-exports deterministic hashing functions from the determinism layer.
 * This is the canonical import path for hashing in Reach.
 *
 * @module lib/hash
 */

export {
  HashStream,
  hashString,
  hashBuffer,
  hashReadableStream,
  combineHashes,
} from '../determinism/hashStream.js';

import { hashString, hashBuffer } from '../determinism/hashStream.js';

/**
 * Simple hash function for strings or buffers - returns hex-encoded hash
 * @param input - String or Buffer to hash
 * @returns Hex-encoded hash string
 */
export function hash(input: string | Buffer): string {
  if (typeof input === 'string') {
    return hashString(input);
  }
  return hashBuffer(input);
}
