#!/usr/bin/env node
/**
 * Fixture Validation Script
 *
 * Validates all JSON fixtures against the schema.
 * Exit code 0 on success, 1 on failure.
 *
 * @module scripts/validate-fixtures
 */

const fs = require("fs");
const path = require("path");

/** @constant {string} */
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

/** @constant {string} */
const SCHEMA_PATH = path.join(FIXTURES_DIR, "schema.json");

/**
 * Validates a fixture file
 * @param {string} filePath - Path to the fixture file
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateFixture(filePath) {
  const errors = [];

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    // Check for _fixture metadata
    if (!data._fixture) {
      errors.push("Missing _fixture metadata");
      return { valid: false, errors };
    }

    const fixture = data._fixture;

    // Required fields
    const required = ["id", "description", "created", "schema_version"];
    for (const field of required) {
      if (!(field in fixture)) {
        errors.push(`Missing required field: _fixture.${field}`);
      }
    }

    // Validate id format (kebab-case)
    if (fixture.id && !/^[a-z0-9-]+$/.test(fixture.id)) {
      errors.push(`Invalid id format: "${fixture.id}" (must be kebab-case)`);
    }

    // Validate date format (YYYY-MM-DD)
    if (fixture.created && !/^\d{4}-\d{2}-\d{2}$/.test(fixture.created)) {
      errors.push(`Invalid date format: "${fixture.created}" (use YYYY-MM-DD)`);
    }

    // Validate semver
    if (fixture.schema_version && !/^\d+\.\d+\.\d+$/.test(fixture.schema_version)) {
      errors.push(`Invalid schema_version: "${fixture.schema_version}" (must be semver)`);
    }

    // Validate complexity enum
    if (fixture.complexity && !["beginner", "intermediate", "advanced"].includes(fixture.complexity)) {
      errors.push(`Invalid complexity: "${fixture.complexity}" (must be beginner/intermediate/advanced)`);
    }

    return { valid: errors.length === 0, errors };
  } catch (e) {
    errors.push(`JSON parse error: ${e.message}`);
    return { valid: false, errors };
  }
}

/**
 * Finds all JSON files in a directory recursively
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function findJsonFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Skip schema.json itself
        if (entry.name !== "schema.json") {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Main validation function
 * @returns {number} Exit code (0 for success, 1 for failure)
 */
function main() {
  console.log("🔍 Validating fixtures...\n");

  // Check if fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error("❌ Fixtures directory not found:", FIXTURES_DIR);
    return 1;
  }

  // Find all JSON files
  const files = findJsonFiles(FIXTURES_DIR);

  if (files.length === 0) {
    console.log("⚠️  No fixture files found");
    return 0;
  }

  console.log(`Found ${files.length} fixture file(s)\n`);

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const result = validateFixture(file);

    if (result.valid) {
      console.log(`✅ ${relativePath}`);
      passed++;
    } else {
      console.log(`❌ ${relativePath}`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
      failed++;
    }
  }

  console.log("\n" + "=".repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n❌ Validation failed");
    return 1;
  }

  console.log("\n✅ All fixtures valid");
  return 0;
}

// Run if executed directly
if (require.main === module) {
  process.exit(main());
}

module.exports = { validateFixture, findJsonFiles };
