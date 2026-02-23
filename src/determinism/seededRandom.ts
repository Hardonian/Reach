/**
 * seededRandom — deterministic pseudo-random number generator
 *
 * A Mulberry32 PRNG seeded with a string seed via a hash function.
 * Produces identical sequences for identical seeds across platforms.
 *
 * Use this instead of Math.random() whenever reproducible randomness is needed
 * (e.g., chaos testing, shuffled test fixtures).
 *
 * DO NOT use for cryptographic purposes.
 */

/**
 * A seeded PRNG instance with a stable sequence.
 */
export interface SeededRng {
  /** Returns the next float in [0, 1). */
  next(): number;
  /** Returns the next integer in [0, max). */
  nextInt(max: number): number;
  /** Returns a random item from the array (preserves array immutability). */
  pick<T>(arr: readonly T[]): T;
  /** Returns a shuffled copy of the array. */
  shuffle<T>(arr: readonly T[]): T[];
}

/**
 * Hashes a string seed to a 32-bit unsigned integer using FNV-1a.
 * This is deterministic, platform-independent, and fast.
 */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG — fast, simple, and deterministic.
 * Returns a function that advances the state and returns a float in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Creates a deterministic PRNG seeded with the given string.
 * The same seed always produces the same sequence.
 *
 * @example
 * const rng = seededRandom("chaos-test-seed");
 * rng.next();     // 0.12345... (stable across platforms)
 * rng.nextInt(5); // 0, 1, 2, 3, or 4 (deterministic)
 */
export function seededRandom(seed: string): SeededRng {
  const advance = mulberry32(hashSeed(seed));

  return {
    next(): number {
      return advance();
    },

    nextInt(max: number): number {
      if (max <= 0) throw new RangeError("max must be positive");
      return Math.floor(advance() * max);
    },

    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0)
        throw new RangeError("Cannot pick from empty array");
      return arr[Math.floor(advance() * arr.length)];
    },

    shuffle<T>(arr: readonly T[]): T[] {
      const result = [...arr];
      // Fisher-Yates in-place shuffle on the copy
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(advance() * (i + 1));
        const tmp = result[i];
        result[i] = result[j];
        result[j] = tmp;
      }
      return result;
    },
  };
}
