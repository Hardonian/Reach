/**
 * hashStream — streaming SHA-256 hasher for large artifacts
 *
 * Hashes data in chunks without buffering the entire input in memory.
 * Suitable for large files (capsule bundles, artifact archives).
 *
 * Uses Node.js built-in crypto — no external dependencies.
 */

import { createHash, Hash } from "crypto";
import { Readable } from "stream";

/**
 * A streaming SHA-256 hash builder.
 * Feed data in chunks, then finalize to get the hex digest.
 *
 * @example
 * const hasher = new HashStream();
 * hasher.update("part1");
 * hasher.update(Buffer.from("part2"));
 * const digest = hasher.finalize(); // hex string
 */
export class HashStream {
  private readonly hash: Hash;
  private finalized = false;

  constructor() {
    this.hash = createHash("sha256");
  }

  /**
   * Feeds a chunk of data into the hash.
   * @throws if called after finalize()
   */
  update(chunk: string | Buffer | Uint8Array): this {
    if (this.finalized) {
      throw new Error("HashStream: cannot update after finalize()");
    }
    this.hash.update(chunk);
    return this;
  }

  /**
   * Finalizes and returns the SHA-256 hex digest.
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
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Hashes a Buffer synchronously.
 */
export function hashBuffer(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Reads a Node.js Readable stream and returns its SHA-256 hex digest.
 * Does not buffer the stream in memory — reads in chunks.
 *
 * @example
 * const digest = await hashReadableStream(fs.createReadStream("large-artifact.zip"));
 */
export async function hashReadableStream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");

    stream.on("data", (chunk: Buffer | string) => {
      hash.update(chunk);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
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
 * combineHashes(["abc123", "def456"]) // sha256 of "abc123:def456"
 */
export function combineHashes(hashes: readonly string[]): string {
  return hashString(hashes.join(":"));
}
