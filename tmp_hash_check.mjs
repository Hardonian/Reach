import { createHash } from "crypto";

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (const key of sortedKeys) result[key] = canonicalize(value[key]);
  return result;
}

function canonicalJson(value) {
  const jsonSafe = JSON.parse(JSON.stringify(value));
  return JSON.stringify(canonicalize(jsonSafe));
}

function h(s) {
  return createHash("sha256").update(s).digest("hex");
}

const tests = [
  { desc: "Simple flat object", input: { action: "deploy", environment: "production" } },
  { desc: "Nested object with sorted keys", input: { b: 2, a: 1, c: { z: 26, a: 1 } } },
  { desc: "Empty object", input: {} },
  { desc: "Array with mixed types", input: { items: [1, "two", true, null, { nested: "value" }] } },
  { desc: "Unicode content", input: { name: "日本語テスト", emoji: "🎯" } },
];

for (const t of tests) {
  const canonical = canonicalJson(t.input);
  const hash = h(canonical);
  console.log(JSON.stringify({ desc: t.desc, canonical, hash }));
}
