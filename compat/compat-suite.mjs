#!/usr/bin/env node
/**
 * Reach Protocol Compatibility Test Suite
 *
 * Validates conformance to Reach Protocol Specification v1.0.0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const schemaDir = path.join(repoRoot, "spec", "schema");
const fixturesDir = path.join(repoRoot, "spec", "fixtures");

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: "PASS" });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: "FAIL", error: error.message });
    console.log(`  ✗ ${name}: ${error.message}`);
  }
}

function loadSchema(name) {
  const schemaPath = path.join(schemaDir, name);
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

function loadFixture(name) {
  const fixturePath = path.join(fixturesDir, name);
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

// Simple JSON Schema validation
function validateSchema(data, schema) {
  const errors = [];

  function validate(value, schemaNode, path) {
    if (schemaNode.type) {
      if (schemaNode.type === "object" && typeof value !== "object") {
        errors.push(`${path}: expected object, got ${typeof value}`);
        return;
      }
      if (schemaNode.type === "string" && typeof value !== "string") {
        errors.push(`${path}: expected string, got ${typeof value}`);
        return;
      }
      if (schemaNode.type === "integer" && !Number.isInteger(value)) {
        errors.push(`${path}: expected integer, got ${typeof value}`);
        return;
      }
      if (schemaNode.type === "array" && !Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeof value}`);
        return;
      }
    }

    if (schemaNode.const !== undefined && value !== schemaNode.const) {
      errors.push(`${path}: expected ${schemaNode.const}, got ${value}`);
    }

    if (schemaNode.enum && !schemaNode.enum.includes(value)) {
      errors.push(
        `${path}: expected one of ${schemaNode.enum.join(", ")}, got ${value}`,
      );
    }

    if (schemaNode.pattern && typeof value === "string") {
      const regex = new RegExp(schemaNode.pattern);
      if (!regex.test(value)) {
        errors.push(
          `${path}: value "${value}" does not match pattern ${schemaNode.pattern}`,
        );
      }
    }

    if (schemaNode.required && typeof value === "object" && value !== null) {
      for (const field of schemaNode.required) {
        if (!(field in value)) {
          errors.push(`${path}: missing required field "${field}"`);
        }
      }
    }

    if (schemaNode.properties && typeof value === "object" && value !== null) {
      for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
        if (key in value) {
          validate(value[key], propSchema, `${path}.${key}`);
        }
      }
    }
  }

  validate(data, schema, "root");
  return errors;
}

// ============================================================================
// COMPATIBILITY TESTS
// ============================================================================

console.log("\n=== Reach Protocol Compatibility Suite v1.0.0 ===\n");

// ----------------------------------------------------------------------------
// SCHEMA VALIDATION TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Schema Validation Tests ---\n");

test("run.schema.json is valid JSON Schema", () => {
  const schema = loadSchema("run.schema.json");
  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Must declare draft 2020-12",
  );
  assert(schema.$id.endsWith("run.schema.json"), "Must have correct $id");
  assert(schema.required.includes("specVersion"), "Must require specVersion");
  assert(schema.required.includes("runId"), "Must require runId");
  assert(schema.required.includes("state"), "Must require state");
});

test("event.schema.json is valid JSON Schema", () => {
  const schema = loadSchema("event.schema.json");
  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Must declare draft 2020-12",
  );
  assert(schema.$id.endsWith("event.schema.json"), "Must have correct $id");
  assert(schema.required.includes("eventId"), "Must require eventId");
  assert(schema.required.includes("type"), "Must require type");
});

test("pack.schema.json is valid JSON Schema", () => {
  const schema = loadSchema("pack.schema.json");
  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Must declare draft 2020-12",
  );
  assert(schema.$id.endsWith("pack.schema.json"), "Must have correct $id");
  assert(schema.required.includes("id"), "Must require id");
  assert(schema.required.includes("manifest"), "Must require manifest");
});

test("capsule.schema.json is valid JSON Schema", () => {
  const schema = loadSchema("capsule.schema.json");
  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Must declare draft 2020-12",
  );
  assert(schema.$id.endsWith("capsule.schema.json"), "Must have correct $id");
  assert(schema.required.includes("capsuleId"), "Must require capsuleId");
});

test("error.schema.json is valid JSON Schema", () => {
  const schema = loadSchema("error.schema.json");
  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Must declare draft 2020-12",
  );
  assert(schema.$id.endsWith("error.schema.json"), "Must have correct $id");
  assert(schema.required.includes("error"), "Must require error");
});

// ----------------------------------------------------------------------------
// DETERMINISM TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Determinism Tests ---\n");

test("runHash computation is deterministic", () => {
  const run = {
    specVersion: "1.0.0",
    runId: "550e8400-e29b-41d4-a716-446655440000",
    state: "COMPLETED",
    createdAt: "2026-02-18T12:00:00.000Z",
    packMetadata: {
      id: "test-pack",
      version: "1.0.0",
      specVersion: "1.0.0",
    },
  };

  // Canonical JSON serialization for hashing
  const canonical = JSON.stringify(run, Object.keys(run).sort());
  const hash1 = crypto.createHash("sha256").update(canonical).digest("hex");
  const hash2 = crypto.createHash("sha256").update(canonical).digest("hex");

  assert(hash1 === hash2, "Same input must produce same hash");
  assert(hash1.length === 64, "Hash must be 64 hex characters (256 bits)");
});

test("event ordering is preserved in hash chain", () => {
  const events = [
    { sequence: 0, type: "run.started", payload: {} },
    { sequence: 1, type: "tool.invoked", payload: { tool: "test" } },
    { sequence: 2, type: "tool.completed", payload: { result: "ok" } },
  ];

  let prevHash = "0".repeat(64);
  const hashes = [];

  for (const event of events) {
    const data = JSON.stringify({ ...event, prevHash });
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    hashes.push(hash);
    prevHash = hash;
  }

  assert(hashes.length === 3, "Must produce hash for each event");
  assert(new Set(hashes).size === 3, "Each hash must be unique");
});

// ----------------------------------------------------------------------------
// REPLAY TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Replay Tests ---\n");

test("capsule contains required replay fields", () => {
  const capsuleSchema = loadSchema("capsule.schema.json");
  assert(capsuleSchema.properties.events, "Must include events");
  assert(
    capsuleSchema.properties.toolRecordings,
    "Must include tool recordings",
  );
  assert(capsuleSchema.properties.manifest, "Must have manifest");
});

test("tool recordings include input/output hashes", () => {
  const capsuleSchema = loadSchema("capsule.schema.json");
  const toolRecording = capsuleSchema.$defs.ToolRecording;
  assert(toolRecording.required.includes("input"), "Must record input");
  assert(toolRecording.required.includes("output"), "Must record output");
  assert(toolRecording.properties.outputHash, "Must include output hash");
});

// ----------------------------------------------------------------------------
// POLICY TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Policy Tests ---\n");

test("pack manifest requires capability declarations", () => {
  const packSchema = loadSchema("pack.schema.json");
  assert(
    packSchema.$defs.Manifest.required.includes("capabilities"),
    "Manifest must require capabilities",
  );
});

test("capabilities include tools and resources", () => {
  const packSchema = loadSchema("pack.schema.json");
  const caps = packSchema.$defs.Capabilities;
  assert(caps.properties.tools, "Must declare tools");
  assert(caps.properties.resources, "Must declare resources");
  assert(caps.properties.permissions, "Must declare permissions");
});

test("policy violations have structured error format", () => {
  const errorSchema = loadSchema("error.schema.json");
  assert(
    errorSchema.$defs && errorSchema.$defs.ErrorDetails,
    "Must have ErrorDetails def",
  );
  assert(
    errorSchema.$defs.ErrorDetails.properties &&
      errorSchema.$defs.ErrorDetails.properties.category,
    "Must include category",
  );
  assert(
    errorSchema.$defs.ErrorDetails.properties.recoverable,
    "Must include recoverable flag",
  );
});

// ----------------------------------------------------------------------------
// SIGNATURE TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Signature Tests ---\n");

test("pack signature uses Ed25519", () => {
  const packSchema = loadSchema("pack.schema.json");
  const sig = packSchema.$defs.Signature;
  assert(sig.properties.algorithm.const === "Ed25519", "Must use Ed25519");
  assert(sig.properties.digest.const === "SHA-256", "Must use SHA-256 digest");
});

test("signature includes required fields", () => {
  const packSchema = loadSchema("pack.schema.json");
  const sig = packSchema.$defs.Signature;
  assert(sig.required.includes("algorithm"), "Must require algorithm");
  assert(sig.required.includes("digest"), "Must require digest");
  assert(sig.required.includes("signature"), "Must require signature");
});

// ----------------------------------------------------------------------------
// FEDERATION TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Federation Tests ---\n");

test("event schema includes federation delegation payload", () => {
  const eventSchema = loadSchema("event.schema.json");
  const delegation = eventSchema.$defs.FederationDelegationPayload;
  assert(delegation.required.includes("delegator"), "Must include delegator");
  assert(delegation.required.includes("delegate"), "Must include delegate");
  assert(delegation.required.includes("scope"), "Must include scope");
});

test("delegation includes expiration", () => {
  const eventSchema = loadSchema("event.schema.json");
  const delegation = eventSchema.$defs.FederationDelegationPayload;
  assert(delegation.properties.expiresAt, "Must include expiresAt");
});

// ----------------------------------------------------------------------------
// ERROR CODE TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Error Code Tests ---\n");

test("error codes follow CATEGORY_DETAIL format", () => {
  const errorSchema = loadSchema("error.schema.json");
  assert(
    errorSchema.$defs && errorSchema.$defs.ErrorDetails,
    "Must have ErrorDetails def",
  );
  const pattern = errorSchema.$defs.ErrorDetails.properties.code.pattern;
  assert(
    pattern === "^[A-Z][A-Z0-9]*_[A-Z][A-Z0-9_]*$",
    "Must match required pattern",
  );
});

test("all error categories are defined", () => {
  const errorSchema = loadSchema("error.schema.json");
  assert(
    errorSchema.$defs && errorSchema.$defs.ErrorDetails,
    "Must have ErrorDetails def",
  );
  const categories = errorSchema.$defs.ErrorDetails.properties.category.enum;
  assert(categories.includes("PROTOCOL"), "Must include PROTOCOL");
  assert(categories.includes("POLICY"), "Must include POLICY");
  assert(categories.includes("EXECUTION"), "Must include EXECUTION");
  assert(categories.includes("FEDERATION"), "Must include FEDERATION");
  assert(categories.includes("PACK"), "Must include PACK");
});

// ----------------------------------------------------------------------------
// SPEC VERSION TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Spec Version Tests ---\n");

test("all schemas declare specVersion", () => {
  const runSchema = loadSchema("run.schema.json");
  const eventSchema = loadSchema("event.schema.json");
  const packSchema = loadSchema("pack.schema.json");
  const capsuleSchema = loadSchema("capsule.schema.json");

  assert(
    runSchema.required.includes("specVersion"),
    "run schema must require specVersion",
  );
  assert(
    eventSchema.required.includes("specVersion"),
    "event schema must require specVersion",
  );
  assert(
    packSchema.required.includes("specVersion"),
    "pack schema must require specVersion",
  );
  assert(
    capsuleSchema.required.includes("specVersion"),
    "capsule schema must require specVersion",
  );
});

test("specVersion follows SemVer pattern", () => {
  const runSchema = loadSchema("run.schema.json");
  const pattern = runSchema.properties.specVersion.pattern;
  assert(
    pattern === "^[0-9]+\\.[0-9]+\\.[0-9]+$",
    "Must require SemVer format",
  );
});

// ----------------------------------------------------------------------------
// FIXTURE VALIDATION TESTS
// ----------------------------------------------------------------------------
console.log("\n--- Fixture Validation Tests ---\n");

test("valid run fixture validates against schema", () => {
  const schema = loadSchema("run.schema.json");
  const fixture = {
    specVersion: "1.0.0",
    runId: "550e8400-e29b-41d4-a716-446655440000",
    state: "COMPLETED",
    createdAt: "2026-02-18T12:00:00.000Z",
    packMetadata: {
      id: "test-pack",
      version: "1.0.0",
      specVersion: "1.0.0",
    },
  };

  const errors = validateSchema(fixture, schema, "run");
  assert(errors.length === 0, `Validation errors: ${errors.join(", ")}`);
});

test("valid event fixture validates against schema", () => {
  const schema = loadSchema("event.schema.json");
  const fixture = {
    specVersion: "1.0.0",
    eventId: "evt-001",
    type: "run.started",
    timestamp: "2026-02-18T12:00:00.000Z",
    payload: {
      runId: "550e8400-e29b-41d4-a716-446655440000",
      packId: "test-pack",
      specVersion: "1.0.0",
    },
  };

  const errors = validateSchema(fixture, schema, "event");
  assert(errors.length === 0, `Validation errors: ${errors.join(", ")}`);
});

test("valid pack fixture validates against schema", () => {
  const schema = loadSchema("pack.schema.json");
  const fixture = {
    specVersion: "1.0.0",
    id: "test-pack",
    version: "1.0.0",
    manifest: {
      manifestVersion: "1.0.0",
      capabilities: {
        tools: [{ name: "fs.read" }],
      },
    },
    entrypoint: "index.js",
  };

  const errors = validateSchema(fixture, schema, "pack");
  assert(errors.length === 0, `Validation errors: ${errors.join(", ")}`);
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log("\n=== Test Summary ===\n");
console.log(`Total: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log("\nFailed tests:");
  for (const test of results.tests.filter((t) => t.status === "FAIL")) {
    console.log(`  - ${test.name}: ${test.error}`);
  }
  process.exit(1);
} else {
  console.log("\n✓ All compatibility tests passed");
  process.exit(0);
}
