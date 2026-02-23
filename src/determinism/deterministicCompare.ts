/**
 * deterministicCompare — locale-independent string comparison
 *
 * The native locale-based string comparison function uses the system default locale when
 * called without explicit locale/collation options. This produces
 * nondeterministic output across platforms and environments.
 *
 * All sorting in hash-contributing paths MUST use these functions instead.
 * Non-hash-contributing paths (CLI display) SHOULD use them for consistency.
 *
 * Comparison semantics: Unicode code-point order (the same ordering used
 * by JavaScript's `<` and `>` operators on strings). This is stable,
 * platform-independent, and requires no ICU/Intl dependency.
 */

/**
 * Compare two strings by Unicode code-point order.
 * Returns -1, 0, or 1 — suitable as a direct Array.sort() comparator.
 *
 * @example
 * ["b", "a", "c"].sort(codePointCompare) // ["a", "b", "c"]
 */
export function codePointCompare(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Creates a comparator that compares objects by a string property key,
 * using code-point order. Suitable for Array.sort().
 *
 * @example
 * items.sort(byStringKey("id"))
 */
export function byStringKey<T>(key: keyof T): (a: T, b: T) => -1 | 0 | 1 {
  return (a: T, b: T) => {
    const av = String(a[key] ?? "");
    const bv = String(b[key] ?? "");
    return codePointCompare(av, bv);
  };
}

/**
 * Creates a comparator that chains multiple comparators.
 * Falls through to the next comparator when the current returns 0.
 *
 * @example
 * items.sort(chainCompare(
 *   byStringKey("category"),
 *   byStringKey("id"),
 * ))
 */
export function chainCompare<T>(
  ...comparators: Array<(a: T, b: T) => number>
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}
