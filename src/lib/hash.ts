/**
 * Hashing Module
 *
 * This module provides a centralized implementation of the BLAKE3 hashing algorithm.
 * All fingerprinting and hashing operations in the engine should use this module
 * to ensure consistency and determinism.
 *
 * @module lib/hash
 */

import { hash as blake3Hash } from 'blake3';

/**
 * Computes a BLAKE3 hash of the given data.
 *
 * @param data - The data to hash. Can be a string or Buffer.
 * @returns The hex-encoded BLAKE3 hash.
 */
export function hash(data: string | Buffer): string {
  return blake3Hash(data).toString('hex');
}
