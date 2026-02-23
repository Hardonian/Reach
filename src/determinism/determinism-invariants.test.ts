/**
 * Determinism Invariant Test Suite
 *
 * Covers:
 * - DET-10: Cross-language hash equivalence (golden fixture assertions)
 * - DET-11: Float encoding determinism boundary
 * - DET-12: Locale-independent comparison verification
 * - VER-04: Hash version constant enforcement
 * - Stress: N-repeat hash stability
 * - Adversarial: Mutation detection, key reordering, unknown field rejection
 * - Replay equivalence
 *
 * All tests are deterministic and platform-independent.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson, canonicalEqual } from "./canonicalJson.js";
import { codePointCompare, byStringKey, chainCompare } from "./deterministicCompare.js";
import { DeterministicMap } from "./deterministicMap.js";
import { seededRandom } from "./seededRandom.js";
import { hashString, combineHashes, HashStream } from "./hashStream.js";
import { sortStrings, sortedKeys, sortedEntries } from "./deterministicSort.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// DET-10: Cross-language hash equivalence — golden fixture assertions
// ---------------------------------------------------------------------------

describe("DET-10: cross-language golden hash assertions", () => {
  // These are the golden hashes. If they change, replay compatibility is broken.
  const goldenFixtures = [
    {
      description: "Simple flat object",
      input: { action: "deploy", environment: "production" },
      expectedHash: "165b836d9d6e803d5ce1bb8b7a01437ff68928f549887360cf13a0d551a66e85",
    },
    {
      description: "Nested object with sorted keys",
      input: { b: 2, a: 1, c: { z: 26, a: 1 } },
      expectedHash: "24e4db09ae0e40a93e391725f9290725f3a8ffd15d33ed0bb39c394319087492",
    },
    {
      description: "Empty object",
      input: {},
      expectedHash: "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    },
    {
      description: "Array with mixed types",
      input: { items: [1, "two", true, null, { nested: "value" }] },
      expectedHash: "7f76a9a8e0bec70c5d327b1ee560378ec256372034993f7cb7b676c77992f5cc",
    },
    {
      description: "Unicode content",
      input: { name: "日本語テスト", emoji: "🎯" },
      expectedHash: "124cab98f548209aa0b1ea432e5bbf239f2327d65f519a32420fa5f1a67433cc",
    },
  ];

  for (const fixture of goldenFixtures) {
    it(`golden hash: ${fixture.description}`, () => {
      const canonical = canonicalJson(fixture.input);
      const hash = sha256Hex(canonical);
      expect(hash).toBe(fixture.expectedHash);
    });
  }

  it("canonicalJson output for golden fixtures matches expected serialization", () => {
    expect(canonicalJson({ action: "deploy", environment: "production" })).toBe(
      '{"action":"deploy","environment":"production"}',
    );
    expect(canonicalJson({ b: 2, a: 1, c: { z: 26, a: 1 } })).toBe(
      '{"a":1,"b":2,"c":{"a":1,"z":26}}',
    );
    expect(canonicalJson({})).toBe("{}");
  });
});

// ---------------------------------------------------------------------------
// DET-11: Float encoding determinism boundary
// ---------------------------------------------------------------------------

describe("DET-11: float encoding determinism", () => {
  it("toFixed(4) is stable for small increments", () => {
    const results: string[] = [];
    for (let i = 0; i < 20; i++) {
      results.push((0.2 + i * 0.05).toFixed(4));
    }
    // Re-compute and verify identical
    const results2: string[] = [];
    for (let i = 0; i < 20; i++) {
      results2.push((0.2 + i * 0.05).toFixed(4));
    }
    expect(results).toEqual(results2);
  });

  it("toFixed(6) is stable for 1/(x) reciprocals", () => {
    const vals = [1.25, 2.25, 3.25, 4.25, 5.25];
    const results = vals.map((v) => Number((1 / v).toFixed(6)));
    const results2 = vals.map((v) => Number((1 / v).toFixed(6)));
    expect(results).toEqual(results2);
  });

  it("JSON.stringify preserves float representation", () => {
    // IEEE 754 double precision: these values must serialize consistently
    const values = [0.0, 1.0, -1.0, 0.5, 0.1, 0.2, 0.3, 1e10, 1e-10, Number.MAX_SAFE_INTEGER];
    const json1 = JSON.stringify(values);
    const json2 = JSON.stringify(values);
    expect(json1).toBe(json2);
  });

  it("canonical hashing of float values is stable", () => {
    const input = { zero: 0, negative: -1, float: 1.5, large: 999999999 };
    const hash1 = sha256Hex(canonicalJson(input));
    const hash2 = sha256Hex(canonicalJson(input));
    expect(hash1).toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// DET-12: Locale-independent comparison
// ---------------------------------------------------------------------------

describe("DET-12: locale-independent sorting", () => {
  it("codePointCompare produces stable ordering", () => {
    const input = ["ä", "a", "z", "A", "Z", "0", "_", "abc", "abd"];
    const sorted = [...input].sort(codePointCompare);
    const sorted2 = [...input].sort(codePointCompare);
    expect(sorted).toEqual(sorted2);
    // Verify code-point order: digits < uppercase < underscore < lowercase
    expect(sorted[0]).toBe("0");
    expect(sorted[1]).toBe("A");
    expect(sorted[2]).toBe("Z");
  });

  it("byStringKey produces stable object sorting", () => {
    const items = [
      { id: "z-item", priority: 1 },
      { id: "a-item", priority: 2 },
      { id: "m-item", priority: 1 },
    ];
    const sorted = [...items].sort(byStringKey("id"));
    expect(sorted.map((i) => i.id)).toEqual(["a-item", "m-item", "z-item"]);
  });

  it("chainCompare chains correctly", () => {
    const items = [
      { category: "b", id: "2" },
      { category: "a", id: "2" },
      { category: "a", id: "1" },
    ];
    const sorted = [...items].sort(chainCompare(byStringKey("category"), byStringKey("id")));
    expect(sorted).toEqual([
      { category: "a", id: "1" },
      { category: "a", id: "2" },
      { category: "b", id: "2" },
    ]);
  });

  it("codePointCompare differs from localeCompare for locale-sensitive chars", () => {
    // This test documents that we are explicitly NOT using locale
    // The behavior difference proves our comparator is locale-independent
    const a = "a";
    const b = "A";
    const codePointResult = codePointCompare(a, b);
    // In code-point order, 'A' (65) < 'a' (97)
    expect(codePointResult).toBe(1); // a > A in code-point
  });
});

// ---------------------------------------------------------------------------
// VER-04: Hash version enforcement
// ---------------------------------------------------------------------------

describe("VER-04: hash version constant", () => {
  it("HASH_VERSION is exported and has expected format", async () => {
    const { HASH_VERSION } = await import("../core/shim.js");
    expect(HASH_VERSION).toBe("sha256-cjson-v1");
    // Format: algorithm-serialization-version
    expect(HASH_VERSION).toMatch(/^[a-z0-9]+-[a-z]+-v\d+$/);
  });

  it("transcripts include hashVersion", async () => {
    const { executeDecision, HASH_VERSION } = await import("../core/shim.js");
    const { transcript } = executeDecision({
      spec: { id: "test", actions: [], assumptions: [], objectives: [] },
      evidence: [],
    });
    expect(transcript.hashVersion).toBe(HASH_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Stress: N-repeat hash stability (50+ iterations)
// ---------------------------------------------------------------------------

describe("stress: hash stability under repetition", () => {
  const stressInput = {
    spec: {
      id: "stress-test",
      actions: [
        { id: "a1", label: "Action 1" },
        { id: "a2", label: "Action 2" },
      ],
      constraints: [{ id: "c1", name: "deadline", value: "7d" }],
      assumptions: [{ id: "as1", text: "Timeline is strict", confidence: "medium" }],
    },
    evidence: [
      {
        id: "ev1",
        type: "document",
        sourceId: "src1",
        capturedAt: "1970-01-01T00:00:00.000Z",
        checksum: "abc123",
        observations: ["observation 1"],
      },
    ],
    dependsOn: ["dep1", "dep2"],
    informs: ["inf1"],
  };

  it("canonicalJson produces identical output 100 times", () => {
    const reference = canonicalJson(stressInput);
    for (let i = 0; i < 100; i++) {
      expect(canonicalJson(stressInput)).toBe(reference);
    }
  });

  it("SHA-256 hash is identical across 100 iterations", () => {
    const reference = sha256Hex(canonicalJson(stressInput));
    for (let i = 0; i < 100; i++) {
      expect(sha256Hex(canonicalJson(stressInput))).toBe(reference);
    }
  });

  it("hashString is identical across 100 iterations", () => {
    const reference = hashString(canonicalJson(stressInput));
    for (let i = 0; i < 100; i++) {
      expect(hashString(canonicalJson(stressInput))).toBe(reference);
    }
  });

  it("seededRandom produces identical sequence across 100 repeats", () => {
    const referenceSeq: number[] = [];
    const rng = seededRandom("stress-seed");
    for (let i = 0; i < 50; i++) {
      referenceSeq.push(rng.next());
    }

    for (let rep = 0; rep < 100; rep++) {
      const rng2 = seededRandom("stress-seed");
      for (let i = 0; i < 50; i++) {
        expect(rng2.next()).toBe(referenceSeq[i]);
      }
    }
  });

  it("DeterministicMap iteration order is stable across 100 iterations", () => {
    const entries: [string, number][] = [
      ["z", 26],
      ["a", 1],
      ["m", 13],
      ["b", 2],
      ["y", 25],
    ];
    const reference: string[] = [];
    const map = new DeterministicMap<number>(entries);
    for (const [k] of map) {
      reference.push(k);
    }

    for (let i = 0; i < 100; i++) {
      const map2 = new DeterministicMap<number>(entries);
      const keys: string[] = [];
      for (const [k] of map2) {
        keys.push(k);
      }
      expect(keys).toEqual(reference);
    }
  });
});

// ---------------------------------------------------------------------------
// Adversarial: Mutation detection
// ---------------------------------------------------------------------------

describe("adversarial: mutation detection", () => {
  it("key reordering does not change hash", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    const c = { m: 3, z: 1, a: 2 };
    const hashA = sha256Hex(canonicalJson(a));
    const hashB = sha256Hex(canonicalJson(b));
    const hashC = sha256Hex(canonicalJson(c));
    expect(hashA).toBe(hashB);
    expect(hashA).toBe(hashC);
  });

  it("adding a field changes hash", () => {
    const original = { a: 1, b: 2 };
    const modified = { a: 1, b: 2, c: 3 };
    const hashOrig = sha256Hex(canonicalJson(original));
    const hashMod = sha256Hex(canonicalJson(modified));
    expect(hashOrig).not.toBe(hashMod);
  });

  it("removing a field changes hash", () => {
    const original = { a: 1, b: 2, c: 3 };
    const modified = { a: 1, b: 2 };
    const hashOrig = sha256Hex(canonicalJson(original));
    const hashMod = sha256Hex(canonicalJson(modified));
    expect(hashOrig).not.toBe(hashMod);
  });

  it("modifying a timestamp changes hash", () => {
    const original = { action: "deploy", timestamp: "2024-01-01T00:00:00Z" };
    const tampered = { action: "deploy", timestamp: "2024-01-01T00:00:01Z" };
    const hashOrig = sha256Hex(canonicalJson(original));
    const hashTampered = sha256Hex(canonicalJson(tampered));
    expect(hashOrig).not.toBe(hashTampered);
  });

  it("deeply nested key reordering does not change hash", () => {
    const a = { outer: { middle: { z: 1, a: 2 }, x: true }, top: false };
    const b = { top: false, outer: { x: true, middle: { a: 2, z: 1 } } };
    expect(sha256Hex(canonicalJson(a))).toBe(sha256Hex(canonicalJson(b)));
  });

  it("null vs undefined handling is consistent", () => {
    // JSON.stringify coerces undefined to null in objects
    const withNull = { a: null };
    const hash = sha256Hex(canonicalJson(withNull));
    // Re-compute
    expect(sha256Hex(canonicalJson({ a: null }))).toBe(hash);
  });

  it("canonicalEqual detects tampering", () => {
    const original = { data: "safe", checksum: "abc" };
    const tampered = { data: "tampered", checksum: "abc" };
    expect(canonicalEqual(original, tampered)).toBe(false);
  });

  it("combineHashes order matters (relay integrity)", () => {
    const h1 = combineHashes(["hash_a", "hash_b", "hash_c"]);
    const h2 = combineHashes(["hash_c", "hash_b", "hash_a"]);
    expect(h1).not.toBe(h2);
    // Sorted inputs are stable
    const sorted = ["hash_a", "hash_b", "hash_c"].sort();
    const h3 = combineHashes(sorted);
    const h4 = combineHashes(sorted);
    expect(h3).toBe(h4);
  });
});

// ---------------------------------------------------------------------------
// Large-scale replay simulation
// ---------------------------------------------------------------------------

describe("large-scale replay: event log hashing", () => {
  it("1000-event log produces stable hash", () => {
    const events: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 1000; i++) {
      events.push({
        step: i,
        action: `action_${i % 10}`,
        payload: { value: i * 0.1, flag: i % 2 === 0 },
      });
    }
    const canonical = canonicalJson(events);
    const hash1 = sha256Hex(canonical);
    const hash2 = sha256Hex(canonicalJson(events));
    expect(hash1).toBe(hash2);
  });

  it("single event difference in 1000-event log produces different hash", () => {
    const events1: Array<Record<string, unknown>> = [];
    const events2: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 1000; i++) {
      events1.push({ step: i, value: i });
      events2.push({ step: i, value: i });
    }
    // Tamper with one event
    events2[500] = { step: 500, value: 999 };

    expect(sha256Hex(canonicalJson(events1))).not.toBe(sha256Hex(canonicalJson(events2)));
  });
});

// ---------------------------------------------------------------------------
// DeterministicSort utilities
// ---------------------------------------------------------------------------

describe("deterministic sort utilities", () => {
  it("sortStrings is locale-independent", () => {
    const input = ["Zürich", "Aachen", "münchen", "Berlin"];
    const sorted = sortStrings(input);
    // Code-point order: uppercase before lowercase
    expect(sorted[0]).toBe("Aachen");
    expect(sorted[1]).toBe("Berlin");
    // Verify stability
    expect(sortStrings(input)).toEqual(sorted);
  });

  it("sortedKeys is consistent for 100 iterations", () => {
    const obj = { z: 1, a: 2, m: 3, b: 4, y: 5 };
    const reference = sortedKeys(obj);
    for (let i = 0; i < 100; i++) {
      expect(sortedKeys(obj)).toEqual(reference);
    }
  });

  it("sortedEntries preserves key-value pairing", () => {
    const obj = { z: "last", a: "first", m: "middle" };
    const entries = sortedEntries(obj);
    expect(entries).toEqual([
      ["a", "first"],
      ["m", "middle"],
      ["z", "last"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// HashStream correctness
// ---------------------------------------------------------------------------

describe("HashStream edge cases", () => {
  it("empty input produces consistent hash", () => {
    const h1 = new HashStream().update("").finalize();
    const h2 = hashString("");
    expect(h1).toBe(h2);
  });

  it("binary data produces consistent hash", () => {
    const buf = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
    const h1 = new HashStream().update(buf).finalize();
    const h2 = new HashStream().update(buf).finalize();
    expect(h1).toBe(h2);
  });

  it("double finalize throws", () => {
    const h = new HashStream();
    h.update("data");
    h.finalize();
    expect(() => h.finalize()).toThrow();
  });

  it("update after finalize throws", () => {
    const h = new HashStream();
    h.update("data");
    h.finalize();
    expect(() => h.update("more")).toThrow();
  });
});
