#!/usr/bin/env node
/**
 * reach-compat CLI
 * 
 * Commands:
 *   reach-compat run          Run compatibility test suite
 *   reach-compat verify       Verify spec conformance
 *   reach-compat validate <schema> <file>  Validate file against schema
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainstSchema } from "./validate-spec.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const commands = {
  run() {
    console.log("Running Reach Protocol Compatibility Suite...\n");
    const suitePath = path.join(repoRoot, "compat", "compat-suite.mjs");
    
    try {
      execSync(`node "${suitePath}"`, { stdio: "inherit", cwd: repoRoot });
    } catch (error) {
      process.exit(error.status || 1);
    }
  },
  
  verify() {
    console.log("Verifying spec conformance...\n");
    
    // Verify schemas exist and are valid
    const schemaDir = path.join(repoRoot, "spec", "schema");
    const schemas = [
      "run.schema.json",
      "event.schema.json",
      "pack.schema.json",
      "capsule.schema.json",
      "error.schema.json"
    ];
    
    let allValid = true;
    
    for (const schema of schemas) {
      const schemaPath = path.join(schemaDir, schema);
      if (!fs.existsSync(schemaPath)) {
        console.error(`✗ Missing schema: ${schema}`);
        allValid = false;
        continue;
      }
      
      try {
        const content = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
        if (content.$schema !== "https://json-schema.org/draft/2020-12/schema") {
          console.error(`✗ ${schema}: Must declare draft 2020-12`);
          allValid = false;
        } else {
          console.log(`✓ ${schema}`);
        }
      } catch (error) {
        console.error(`✗ ${schema}: Invalid JSON - ${error.message}`);
        allValid = false;
      }
    }
    
    // Verify spec document exists
    const specPath = path.join(repoRoot, "spec", "REACH_PROTOCOL_v1.md");
    if (fs.existsSync(specPath)) {
      console.log(`✓ REACH_PROTOCOL_v1.md`);
    } else {
      console.error(`✗ Missing spec document`);
      allValid = false;
    }
    
    // Run compatibility suite
    console.log("\nRunning compatibility tests...");
    try {
      const suitePath = path.join(repoRoot, "compat", "compat-suite.mjs");
      execSync(`node "${suitePath}"`, { stdio: "inherit", cwd: repoRoot });
    } catch (error) {
      allValid = false;
    }
    
    if (allValid) {
      console.log("\n✓ All verifications passed");
      process.exit(0);
    } else {
      console.log("\n✗ Verification failed");
      process.exit(1);
    }
  },
  
  validate(schemaName, filePath) {
    if (!schemaName || !filePath) {
      console.error("Usage: reach-compat validate <schema-name> <file-path>");
      console.error("  schema-name: run.schema.json, event.schema.json, etc.");
      process.exit(1);
    }
    
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
      } else {
        console.error(`✗ Validation failed against ${schemaName}:`);
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  },
  
  help() {
    console.log(`
reach-compat - Reach Protocol Compatibility Tool

Commands:
  run                    Run the full compatibility test suite
  verify                 Verify spec conformance (schemas + tests)
  validate <schema> <file>  Validate a JSON file against a schema

Schemas:
  run.schema.json
  event.schema.json
  pack.schema.json
  capsule.schema.json
  error.schema.json

Examples:
  node reach-compat.mjs run
  node reach-compat.mjs verify
  node reach-compat.mjs validate run.schema.json ./my-run.json
`);
  }
};

// Main
const args = process.argv.slice(2);
const command = args[0] || "help";

if (commands[command]) {
  commands[command](args[1], args[2]);
} else {
  console.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}
