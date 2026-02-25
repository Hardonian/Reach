#!/usr/bin/env node
/**
 * Reach Spec Validation Tool
 *
 * Validates runtime structures against JSON schemas
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const schemaDir = path.join(repoRoot, "spec", "schema");

// Load schema
function loadSchema(name) {
  const schemaPath = path.join(schemaDir, name);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

// Validate data against schema
function validate(data, schema, path = "root", rootSchema = schema) {
  const errors = [];

  function addError(msg) {
    errors.push(`${path}: ${msg}`);
  }

  // Type validation
  if (schema.type) {
    if (schema.type === "object") {
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        addError(`expected object, got ${typeof data}`);
        return errors;
      }
    } else if (schema.type === "array") {
      if (!Array.isArray(data)) {
        addError(`expected array, got ${typeof data}`);
        return errors;
      }
    } else if (schema.type === "string") {
      if (typeof data !== "string") {
        addError(`expected string, got ${typeof data}`);
        return errors;
      }
    } else if (schema.type === "integer") {
      if (!Number.isInteger(data)) {
        addError(`expected integer, got ${typeof data}`);
        return errors;
      }
    } else if (schema.type === "boolean") {
      if (typeof data !== "boolean") {
        addError(`expected boolean, got ${typeof data}`);
        return errors;
      }
    }
  }

  // Const validation
  if (schema.const !== undefined && data !== schema.const) {
    addError(`expected ${schema.const}, got ${data}`);
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(data)) {
    addError(`expected one of [${schema.enum.join(", ")}], got ${data}`);
  }

  // Pattern validation
  if (schema.pattern && typeof data === "string") {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(data)) {
      addError(`value "${data}" does not match pattern ${schema.pattern}`);
    }
  }

  // Required fields
  if (schema.required && typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const field of schema.required) {
      if (!(field in data)) {
        addError(`missing required field "${field}"`);
      }
    }
  }

  // Properties validation
  if (schema.properties && typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const propErrors = validate(data[key], propSchema, `${path}.${key}`, rootSchema);
        errors.push(...propErrors);
      }
    }
  }

  // Items validation (arrays)
  if (schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const itemErrors = validate(data[i], schema.items, `${path}[${i}]`, rootSchema);
      errors.push(...itemErrors);
    }
  }

  // $ref resolution (simplified - only handles local refs)
  if (schema.$ref && schema.$ref.startsWith("#/$defs/")) {
    const defName = schema.$ref.replace("#/$defs/", "");
    if (rootSchema.$defs && rootSchema.$defs[defName]) {
      const refErrors = validate(data, rootSchema.$defs[defName], path, rootSchema);
      errors.push(...refErrors);
    }
  }

  // oneOf validation
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const validCount = schema.oneOf.filter((subSchema) => {
      const subErrors = validate(data, subSchema, path, rootSchema);
      return subErrors.length === 0;
    }).length;

    if (validCount !== 1) {
      addError(`expected exactly one of oneOf schemas to match, got ${validCount}`);
    }
  }

  return errors;
}

// Main validation function
export function validateAgainstSchema(data, schemaName) {
  const schema = loadSchema(schemaName);
  return validate(data, schema);
}

function runCli() {
  const args = process.argv.slice(2);

  if (args.length === 2) {
    const [schemaName, filePath] = args;

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const errors = validateAgainstSchema(data, schemaName);

      if (errors.length === 0) {
        console.log(`✓ Valid against ${schemaName}`);
        process.exit(0);
      }

      console.error(`✗ Validation failed against ${schemaName}:`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  if (args.length > 0) {
    console.log("Usage:");
    console.log("  node tools/validate-spec.mjs");
    console.log("  node tools/validate-spec.mjs <schema-name> <json-file>");
    process.exit(1);
  }

  const fixturePairs = [
    ["run.schema.json", path.join(repoRoot, "spec", "fixtures", "run.json")],
    ["event.schema.json", path.join(repoRoot, "spec", "fixtures", "event.json")],
    ["pack.schema.json", path.join(repoRoot, "spec", "fixtures", "pack.json")],
    ["capsule.schema.json", path.join(repoRoot, "spec", "fixtures", "capsule.json")],
  ];

  let failed = 0;
  for (const [schemaName, fixturePath] of fixturePairs) {
    if (!fs.existsSync(fixturePath)) {
      console.error(`✗ Missing fixture: ${fixturePath}`);
      failed += 1;
      continue;
    }
    const data = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const errors = validateAgainstSchema(data, schemaName);
    if (errors.length > 0) {
      console.error(`✗ ${schemaName} -> ${path.basename(fixturePath)}`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      failed += 1;
    } else {
      console.log(`✓ ${schemaName} -> ${path.basename(fixturePath)}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runCli();
