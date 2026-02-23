/**
 * deterministicSort — stable, deterministic sorting utilities
 *
 * All sort functions are pure and produce identical output for identical inputs
 * across platforms. They do NOT use locale-sensitive comparisons.
 */

/**
 * Sorts an array of strings using code-point order (stable, locale-independent).
 * Returns a new array; does not mutate the input.
 */
export function sortStrings(arr: readonly string[]): string[] {
  return [...arr].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

/**
 * Sorts an array of numbers in ascending order.
 * Returns a new array; does not mutate the input.
 */
export function sortNumbers(arr: readonly number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/**
 * Sorts an array of objects by a string key.
 * Returns a new array; does not mutate the input.
 *
 * @example
 * sortByKey([{ id: "b" }, { id: "a" }], "id") // [{ id: "a" }, { id: "b" }]
 */
export function sortByKey<T extends Record<string, unknown>>(arr: readonly T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => {
    const av = String(a[key]);
    const bv = String(b[key]);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

/**
 * Sorts an array of objects by a numeric key in ascending order.
 * Returns a new array; does not mutate the input.
 */
export function sortByNumericKey<T extends Record<string, unknown>>(
  arr: readonly T[],
  key: keyof T,
): T[] {
  return [...arr].sort((a, b) => Number(a[key]) - Number(b[key]));
}

/**
 * Sorts an array using a provided comparator, returning a new array.
 * Wraps Array.prototype.sort to ensure immutability.
 */
export function sortWith<T>(arr: readonly T[], comparator: (a: T, b: T) => number): T[] {
  return [...arr].sort(comparator);
}

/**
 * Returns sorted entries of an object as [key, value] pairs.
 * Keys are sorted by code-point order.
 *
 * @example
 * sortedEntries({ b: 2, a: 1 }) // [["a", 1], ["b", 2]]
 */
export function sortedEntries<T>(obj: Record<string, T>): Array<[string, T]> {
  return Object.keys(obj)
    .sort()
    .map((k) => [k, obj[k]]);
}

/**
 * Returns sorted keys of an object by code-point order.
 * Use this instead of Object.keys() in hashing/serialization paths.
 */
export function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}
