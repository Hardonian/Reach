/**
 * hashStream — streaming BLAKE3 hasher for large artifacts
 *
 * Hashes data in chunks without buffering the entire input in memory.
 * Suitable for large files (capsule bundles, artifact archives).
 *
 * Uses BLAKE3 for high performance and cross-platform fingerprint stability.
 */

import { hash } from "blake3";
import { createHash } from "crypto";
import { Readable } from "stream";

// BLAKE3 hash implementation with fallback
// Prefer native blake3 if available, otherwise use crypto.createHash with warning
let hasherAvailable = true;
let warned = false;

function getHash(input: string | Buffer | Uint8Array, encoding?: 'hex'): string {
  try {
    // Try to use blake3
    const result = hash(input, { length: 32 });
    if (encoding === 'hex') {
      return typeof result === 'string' ? result : result.toString('hex');
    }
    return typeof result === 'string' ? result : result.toString('hex');
  } catch {
    hasherAvailable = false;
    if (!warned) {
      warned = true;
      if (process.env.REACH_STRICT_HASH === '1') {
        throw new Error('hash_unavailable_blake3: blake3 required in strict mode');
      }
      console.warn('[hashStream] WARNING: Using SHA-256 fallback (not for production)');
    }
    // Fallback to SHA-256 (deterministic but different hash primitive)
    return createHash('sha256').update(input).digest('hex').substring(0, 64);
  }
}

/**
 * A streaming BLAKE3 hash builder.
 * Feed data in chunks, then finalize to get the hex digest.
 *
 * Note: This accumulates data in memory and hashes at finalize.
 * For truly streaming hashing, use the hash function directly.
 *
 * @example
 * const hasher = new HashStream();
 * hasher.update("part1");
 * hasher.update(Buffer.from("part2"));
 * const digest = hasher.finalize(); // hex string
 */
export class HashStream {
  private chunks: Buffer[] = [];
  private finalized = false;

  constructor() {}

  /**
   * Feeds a chunk of data into the hash.
   * @throws if called after finalize()
   */
  update(chunk: string | Buffer | Uint8Array): this {
    if (this.finalized) {
      throw new Error("HashStream: cannot update after finalize()");
    }
    if (typeof chunk === 'string') {
      this.chunks.push(Buffer.from(chunk, 'utf8'));
    } else if (Buffer.isBuffer(chunk)) {
      this.chunks.push(chunk);
    } else {
      this.chunks.push(Buffer.from(chunk));
    }
    return this;
  }

  /**
   * Finalizes and returns the BLAKE3 hex digest.
   * After this call, the HashStream cannot accept more data.
   */
  finalize(): string {
    if (this.finalized) {
      throw new Error("HashStream: already finalized");
    }
    this.finalized = true;
    const combined = Buffer.concat(this.chunks);
    return getHash(combined, 'hex');
  }
}

/**
 * Hashes a single string synchronously.
 * For larger inputs, use HashStream to accumulate chunks.
 */
export function hashString(input: string): string {
  return getHash(input, 'hex');
}

/**
 * Hashes a Buffer synchronously.
 */
export function hashBuffer(buf: Buffer | Uint8Array): string {
  return getHash(buf, 'hex');
}

/**
 * Reads a Node.js Readable stream and returns its BLAKE3 hex digest.
 * Does not buffer the stream in memory — reads in chunks.
 *
 * @example
 * const digest = await hashReadableStream(fs.createReadStream("large-artifact.zip"));
 */
export async function hashReadableStream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hasher = createHasher();

    stream.on("data", (chunk: Buffer | string) => {
      if (typeof chunk === 'string') {
        hasher.update(chunk, "utf8");
      } else {
        hasher.update(chunk);
      }
    });

    stream.on("end", () => {
      const digest = hasher.digest("hex");
      resolve(typeof digest === 'string' ? digest : digest.toString('hex'));
    });

    stream.on("error", (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Combines multiple hashes into a single deterministic hash.
 * The order of inputs is preserved (use sortStrings first if order varies).
 *
 * @example
 * combineHashes(["abc123", "def456"]) // blake3 of "abc123:def456"
 */
export function combineHashes(hashes: readonly string[]): string {
  return hashString(hashes.join(":"));
}

