/**
 * Unit tests for src/determinism utilities
 *
 * Run with: npx tsx --test src/determinism/__tests__/canonicalJson.test.ts
 * Or via: npm test (if configured in root package.json)
 */

import assert from "assert";
import { test, describe } from "node:test";
import { canonicalJson, canonicalJsonPretty, canonicalEqual } from "../canonicalJson.js";
import { sortStrings, sortByKey, sortedEntries, sortedKeys } from "../deterministicSort.js";
import { DeterministicMap } from "../deterministicMap.js";
import { seededRandom } from "../seededRandom.js";
import { HashStream, hashString, combineHashes } from "../hashStream.js";

// ---------------------------------------------------------------------------
// canonicalJson
// ---------------------------------------------------------------------------

describe("canonicalJson", () => {
  test("sorts object keys alphabetically", () => {
    const result = canonicalJson({ z: 1, a: 2, m: 3 });
    assert.strictEqual(result, '{"a":2,"m":3,"z":1}');
  });

  test("is idempotent for same input regardless of insertion order", () => {
    const a = canonicalJson({ b: 2, a: 1 });
    const b = canonicalJson({ a: 1, b: 2 });
    assert.strictEqual(a, b);
  });

  test("handles nested objects", () => {
    const result = canonicalJson({ z: { y: 1, x: 2 }, a: true });
    assert.strictEqual(result, '{"a":true,"z":{"x":2,"y":1}}');
  });

  test("preserves array order", () => {
    const result = canonicalJson({ items: [3, 1, 2] });
    assert.strictEqual(result, '{"items":[3,1,2]}');
  });

  test("handles null values", () => {
    const result = canonicalJson({ a: null, b: "hello" });
    assert.strictEqual(result, '{"a":null,"b":"hello"}');
  });

  test("handles primitives at top level", () => {
    assert.strictEqual(canonicalJson(42), "42");
    assert.strictEqual(canonicalJson("hello"), '"hello"');
    assert.strictEqual(canonicalJson(null), "null");
  });

  test("does not mutate input", () => {
    const input = { z: 1, a: 2 };
    canonicalJson(input);
    assert.deepStrictEqual(Object.keys(input), ["z", "a"]);
  });

  test("canonicalEqual returns true for same-content objects", () => {
    assert.strictEqual(
      canonicalEqual({ b: 2, a: 1 }, { a: 1, b: 2 }),
      true
    );
  });

  test("canonicalEqual returns false for different objects", () => {
    assert.strictEqual(canonicalEqual({ a: 1 }, { a: 2 }), false);
  });

  test("canonicalJsonPretty has consistent key order", () => {
    const result = canonicalJsonPretty({ c: 3, a: 1, b: 2 });
    const parsed = JSON.parse(result);
    assert.deepStrictEqual(Object.keys(parsed), ["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// deterministicSort
// ---------------------------------------------------------------------------

describe("deterministicSort", () => {
  test("sortStrings returns lexicographic order", () => {
    assert.deepStrictEqual(sortStrings(["c", "a", "b"]), ["a", "b", "c"]);
  });

  test("sortStrings does not mutate input", () => {
    const arr = ["c", "a", "b"];
    sortStrings(arr);
    assert.deepStrictEqual(arr, ["c", "a", "b"]);
  });

  test("sortByKey sorts by string key", () => {
    const items = [{ id: "c" }, { id: "a" }, { id: "b" }];
    const sorted = sortByKey(items, "id");
    assert.deepStrictEqual(
      sorted.map((x) => x.id),
      ["a", "b", "c"]
    );
  });

  test("sortedKeys returns sorted object keys", () => {
    const obj = { z: 1, a: 2, m: 3 };
    assert.deepStrictEqual(sortedKeys(obj), ["a", "m", "z"]);
  });

  test("sortedEntries returns sorted key-value pairs", () => {
    const obj = { z: 1, a: 2 };
    assert.deepStrictEqual(sortedEntries(obj), [
      ["a", 2],
      ["z", 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
// DeterministicMap
// ---------------------------------------------------------------------------

describe("DeterministicMap", () => {
  test("iterates in sorted key order", () => {
    const map = new DeterministicMap<number>();
    map.set("z", 26);
    map.set("a", 1);
    map.set("m", 13);

    const keys: string[] = [];
    for (const [k] of map) {
      keys.push(k);
    }
    assert.deepStrictEqual(keys, ["a", "m", "z"]);
  });

  test("keys() returns sorted keys", () => {
    const map = new DeterministicMap<number>([["c", 3], ["a", 1], ["b", 2]]);
    assert.deepStrictEqual([...map.keys()], ["a", "b", "c"]);
  });

  test("toObject preserves sorted key order", () => {
    const map = new DeterministicMap<number>();
    map.set("z", 1);
    map.set("a", 2);
    const obj = map.toObject();
    assert.deepStrictEqual(Object.keys(obj), ["a", "z"]);
  });

  test("fromObject round-trips correctly", () => {
    const obj = { b: 2, a: 1 };
    const map = DeterministicMap.fromObject(obj);
    assert.strictEqual(map.get("a"), 1);
    assert.strictEqual(map.get("b"), 2);
    assert.strictEqual(map.size, 2);
  });
});

// ---------------------------------------------------------------------------
// seededRandom
// ---------------------------------------------------------------------------

describe("seededRandom", () => {
  test("same seed produces same sequence", () => {
    const r1 = seededRandom("test-seed");
    const r2 = seededRandom("test-seed");
    const seq1 = [r1.next(), r1.next(), r1.next()];
    const seq2 = [r2.next(), r2.next(), r2.next()];
    assert.deepStrictEqual(seq1, seq2);
  });

  test("different seeds produce different sequences", () => {
    const r1 = seededRandom("seed-alpha");
    const r2 = seededRandom("seed-beta");
    assert.notStrictEqual(r1.next(), r2.next());
  });

  test("next() returns value in [0, 1)", () => {
    const rng = seededRandom("range-test");
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `Expected [0,1), got ${v}`);
    }
  });

  test("nextInt() returns integer in [0, max)", () => {
    const rng = seededRandom("int-test");
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(10);
      assert.ok(
        Number.isInteger(v) && v >= 0 && v < 10,
        `Expected [0,10), got ${v}`
      );
    }
  });

  test("shuffle produces stable result for same seed", () => {
    const arr = [1, 2, 3, 4, 5];
    const r1 = seededRandom("shuffle-seed");
    const r2 = seededRandom("shuffle-seed");
    assert.deepStrictEqual(r1.shuffle(arr), r2.shuffle(arr));
  });

  test("shuffle does not mutate input", () => {
    const arr = [1, 2, 3];
    const rng = seededRandom("mutation-test");
    rng.shuffle(arr);
    assert.deepStrictEqual(arr, [1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// HashStream
// ---------------------------------------------------------------------------

describe("HashStream", () => {
  test("produces consistent hash for same input", () => {
    const h1 = new HashStream();
    const h2 = new HashStream();
    h1.update("hello world");
    h2.update("hello world");
    assert.strictEqual(h1.finalize(), h2.finalize());
  });

  test("chunked update equals single update", () => {
    const h1 = new HashStream();
    const h2 = new HashStream();
    h1.update("hello ").update("world");
    h2.update("hello world");
    assert.strictEqual(h1.finalize(), h2.finalize());
  });

  test("throws after finalize", () => {
    const h = new HashStream();
    h.update("data");
    h.finalize();
    assert.throws(() => h.update("more"), /already finalized|after finalize/);
  });

  test("hashString matches single-chunk HashStream", () => {
    const expected = new HashStream().update("test").finalize();
    assert.strictEqual(hashString("test"), expected);
  });

  test("combineHashes is order-sensitive", () => {
    const h1 = combineHashes(["a", "b"]);
    const h2 = combineHashes(["b", "a"]);
    assert.notStrictEqual(h1, h2);
  });

  test("combineHashes with sorted inputs is stable", () => {
    const inputs = ["c", "a", "b"].sort();
    const h1 = combineHashes(inputs);
    const h2 = combineHashes(inputs);
    assert.strictEqual(h1, h2);
  });
});
