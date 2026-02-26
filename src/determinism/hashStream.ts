/**
 * hashStream — streaming BLAKE3 hasher for large artifacts
 *
 * Hashes data in chunks without buffering the entire input in memory.
 * Suitable for large files (capsule bundles, artifact archives).
 *
 * Uses BLAKE3 for high performance and cross-platform fingerprint stability.
 */

import { createHasher, Hasher } from "blake3";
import { Readable } from "stream";

/**
 * A streaming BLAKE3 hash builder.
 * Feed data in chunks, then finalize to get the hex digest.
 *
 * @example
 * const hasher = new HashStream();
 * hasher.update("part1");
 * hasher.update(Buffer.from("part2"));
 * const digest = hasher.finalize(); // hex string
 */
export class HashStream {
  private readonly hash: Hasher;
  private finalized = false;

  constructor() {
    this.hash = createHasher();
  }

  /**
   * Feeds a chunk of data into the hash.
   * @throws if called after finalize()
   */
  update(chunk: string | Buffer | Uint8Array): this {
    if (this.finalized) {
      throw new Error("HashStream: cannot update after finalize()");
    }
    if (typeof chunk === 'string') {
      this.hash.update(chunk, "utf8");
    } else {
      this.hash.update(chunk);
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
    return this.hash.digest("hex");
  }
}

/**
 * Hashes a single string synchronously.
 * For larger inputs, use HashStream to avoid holding the full buffer.
 */
export function hashString(input: string): string {
  const hasher = createHasher();
  hasher.update(input, "utf8");
  return hasher.digest("hex");
}

/**
 * Hashes a Buffer synchronously.
 */
export function hashBuffer(buf: Buffer | Uint8Array): string {
  const hasher = createHasher();
  hasher.update(buf);
  return hasher.digest("hex");
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
      resolve(hasher.digest("hex"));
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

