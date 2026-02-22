/**
 * deterministicMap — a Map wrapper that iterates in sorted key order
 *
 * Standard JavaScript Map iterates in insertion order, which is fine for
 * many use cases but will diverge across runs if keys are inserted in
 * different orders. DeterministicMap always iterates in sorted key order.
 *
 * Use this in any path that contributes to proof hashes or canonical output.
 */

/**
 * A Map that always iterates in lexicographic key order.
 * Reads (get, has, size) are O(1); writes (set, delete) are O(1).
 * Iteration (forEach, entries, keys, values, Symbol.iterator) is O(n log n)
 * because keys are sorted on each iteration.
 */
export class DeterministicMap<V> implements Iterable<[string, V]> {
  private readonly inner: Map<string, V>;

  constructor(entries?: Iterable<[string, V]>) {
    this.inner = new Map(entries);
  }

  get size(): number {
    return this.inner.size;
  }

  get(key: string): V | undefined {
    return this.inner.get(key);
  }

  has(key: string): boolean {
    return this.inner.has(key);
  }

  set(key: string, value: V): this {
    this.inner.set(key, value);
    return this;
  }

  delete(key: string): boolean {
    return this.inner.delete(key);
  }

  clear(): void {
    this.inner.clear();
  }

  /**
   * Iterates in sorted key order.
   */
  [Symbol.iterator](): Iterator<[string, V]> {
    return this.entries();
  }

  /**
   * Returns entries in sorted key order.
   */
  *entries(): Generator<[string, V]> {
    const sortedKeys = [...this.inner.keys()].sort();
    for (const key of sortedKeys) {
      yield [key, this.inner.get(key) as V];
    }
  }

  /**
   * Returns keys in sorted order.
   */
  *keys(): Generator<string> {
    const sortedKeys = [...this.inner.keys()].sort();
    for (const key of sortedKeys) {
      yield key;
    }
  }

  /**
   * Returns values in sorted key order.
   */
  *values(): Generator<V> {
    const sortedKeys = [...this.inner.keys()].sort();
    for (const key of sortedKeys) {
      yield this.inner.get(key) as V;
    }
  }

  /**
   * Iterates in sorted key order.
   */
  forEach(
    callback: (value: V, key: string, map: DeterministicMap<V>) => void
  ): void {
    for (const [key, value] of this.entries()) {
      callback(value, key, this);
    }
  }

  /**
   * Converts to a plain object with sorted keys for canonical serialization.
   */
  toObject(): Record<string, V> {
    const result: Record<string, V> = {};
    for (const [key, value] of this.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Creates a DeterministicMap from a plain object.
   */
  static fromObject<V>(obj: Record<string, V>): DeterministicMap<V> {
    return new DeterministicMap<V>(Object.entries(obj));
  }
}
