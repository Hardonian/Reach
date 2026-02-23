/**
 * Unit tests for src/determinism utilities
 *
 * Run with: npm test
 */

import { describe, it, expect } from "vitest";
import { canonicalJson, canonicalJsonPretty, canonicalEqual } from "../canonicalJson.js";
import { sortStrings, sortByKey, sortedEntries, sortedKeys } from "../deterministicSort.js";
import { DeterministicMap } from "../deterministicMap.js";
import { seededRandom } from "../seededRandom.js";
import { HashStream, hashString, combineHashes } from "../hashStream.js";

// ---------------------------------------------------------------------------
// canonicalJson
// ---------------------------------------------------------------------------

describe("canonicalJson", () => {
  it("sorts object keys alphabetically", () => {
    const result = canonicalJson({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("is idempotent for same input regardless of insertion order", () => {
    const a = canonicalJson({ b: 2, a: 1 });
    const b = canonicalJson({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("handles nested objects", () => {
    const result = canonicalJson({ z: { y: 1, x: 2 }, a: true });
    expect(result).toBe('{"a":true,"z":{"x":2,"y":1}}');
  });

  it("preserves array order", () => {
    const result = canonicalJson({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it("handles null values", () => {
    const result = canonicalJson({ a: null, b: "hello" });
    expect(result).toBe('{"a":null,"b":"hello"}');
  });

  it("handles primitives at top level", () => {
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(null)).toBe("null");
  });

  it("does not mutate input", () => {
    const input = { z: 1, a: 2 };
    canonicalJson(input);
    expect(Object.keys(input)).toEqual(["z", "a"]);
  });

  it("canonicalEqual returns true for same-content objects", () => {
    expect(canonicalEqual({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
  });

  it("canonicalEqual returns false for different objects", () => {
    expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("canonicalJsonPretty has consistent key order", () => {
    const result = canonicalJsonPretty({ c: 3, a: 1, b: 2 });
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// deterministicSort
// ---------------------------------------------------------------------------

describe("deterministicSort", () => {
  it("sortStrings returns lexicographic order", () => {
    expect(sortStrings(["c", "a", "b"])).toEqual(["a", "b", "c"]);
  });

  it("sortStrings does not mutate input", () => {
    const arr = ["c", "a", "b"];
    sortStrings(arr);
    expect(arr).toEqual(["c", "a", "b"]);
  });

  it("sortByKey sorts by string key", () => {
    const items = [{ id: "c" }, { id: "a" }, { id: "b" }];
    const sorted = sortByKey(items, "id");
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("sortedKeys returns sorted object keys", () => {
    const obj = { z: 1, a: 2, m: 3 };
    expect(sortedKeys(obj)).toEqual(["a", "m", "z"]);
  });

  it("sortedEntries returns sorted key-value pairs", () => {
    const obj = { z: 1, a: 2 };
    expect(sortedEntries(obj)).toEqual([["a", 2], ["z", 1]]);
  });
});

// ---------------------------------------------------------------------------
// DeterministicMap
// ---------------------------------------------------------------------------

describe("DeterministicMap", () => {
  it("iterates in sorted key order", () => {
    const map = new DeterministicMap<number>();
    map.set("z", 26);
    map.set("a", 1);
    map.set("m", 13);

    const keys: string[] = [];
    for (const [k] of map) {
      keys.push(k);
    }
    expect(keys).toEqual(["a", "m", "z"]);
  });

  it("keys() returns sorted keys", () => {
    const map = new DeterministicMap<number>([["c", 3], ["a", 1], ["b", 2]]);
    expect([...map.keys()]).toEqual(["a", "b", "c"]);
  });

  it("toObject preserves sorted key order", () => {
    const map = new DeterministicMap<number>();
    map.set("z", 1);
    map.set("a", 2);
    const obj = map.toObject();
    expect(Object.keys(obj)).toEqual(["a", "z"]);
  });

  it("fromObject round-trips correctly", () => {
    const obj = { b: 2, a: 1 };
    const map = DeterministicMap.fromObject(obj);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// seededRandom
// ---------------------------------------------------------------------------

describe("seededRandom", () => {
  it("same seed produces same sequence", () => {
    const r1 = seededRandom("test-seed");
    const r2 = seededRandom("test-seed");
    const seq1 = [r1.next(), r1.next(), r1.next()];
    const seq2 = [r2.next(), r2.next(), r2.next()];
    expect(seq1).toEqual(seq2);
  });

  it("different seeds produce different sequences", () => {
    const r1 = seededRandom("seed-alpha");
    const r2 = seededRandom("seed-beta");
    expect(r1.next()).not.toBe(r2.next());
  });

  it("next() returns value in [0, 1)", () => {
    const rng = seededRandom("range-test");
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt() returns integer in [0, max)", () => {
    const rng = seededRandom("int-test");
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("shuffle produces stable result for same seed", () => {
    const arr = [1, 2, 3, 4, 5];
    const r1 = seededRandom("shuffle-seed");
    const r2 = seededRandom("shuffle-seed");
    expect(r1.shuffle(arr)).toEqual(r2.shuffle(arr));
  });

  it("shuffle does not mutate input", () => {
    const arr = [1, 2, 3];
    const rng = seededRandom("mutation-test");
    rng.shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// HashStream
// ---------------------------------------------------------------------------

describe("HashStream", () => {
  it("produces consistent hash for same input", () => {
    const h1 = new HashStream();
    const h2 = new HashStream();
    h1.update("hello world");
    h2.update("hello world");
    expect(h1.finalize()).toBe(h2.finalize());
  });

  it("chunked update equals single update", () => {
    const h1 = new HashStream();
    const h2 = new HashStream();
    h1.update("hello ").update("world");
    h2.update("hello world");
    expect(h1.finalize()).toBe(h2.finalize());
  });

  it("throws after finalize", () => {
    const h = new HashStream();
    h.update("data");
    h.finalize();
    expect(() => h.update("more")).toThrow(/already finalized|after finalize/);
  });

  it("hashString matches single-chunk HashStream", () => {
    const expected = new HashStream().update("test").finalize();
    expect(hashString("test")).toBe(expected);
  });

  it("combineHashes is order-sensitive", () => {
    const h1 = combineHashes(["a", "b"]);
    const h2 = combineHashes(["b", "a"]);
    expect(h1).not.toBe(h2);
  });

  it("combineHashes with sorted inputs is stable", () => {
    const inputs = ["c", "a", "b"].sort();
    const h1 = combineHashes(inputs);
    const h2 = combineHashes(inputs);
    expect(h1).toBe(h2);
  });
});
