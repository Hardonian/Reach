import { createHash } from "crypto";

// canonicalJson implementation
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

const tests = [
  { desc: "Simple flat object", input: { action: "deploy", environment: "production" }, expected: "c30b67fdb03e3e614ec69c7a7837c974fb5bead7476eeee6c23a7ec2ffdbe4ff" },
  { desc: "Nested", input: { b: 2, a: 1, c: { z: 26, a: 1 } }, expected: "44d0a9b0b0dd87a9e337c5df56fc6001abbc8cc760a0aa8a53cd41b24e1e29b2" },
  { desc: "Empty", input: {}, expected: "44136fa355b311bfa706c3cf3c82f48ab0be64adee2da4ab1af85e62e703e313" },
];

for (const t of tests) {
  const canonical = canonicalJson(t.input);
  const withUtf8 = createHash("sha256").update(canonical, "utf8").digest("hex");
  const withoutUtf8 = createHash("sha256").update(canonical).digest("hex");
  console.log(`${t.desc}:`);
  console.log(`  canonical:   ${canonical}`);
  console.log(`  with utf8:   ${withUtf8}`);
  console.log(`  without:     ${withoutUtf8}`);
  console.log(`  expected:    ${t.expected}`);
  console.log(`  match utf8:  ${withUtf8 === t.expected}`);
  console.log(`  match plain: ${withoutUtf8 === t.expected}`);
}
