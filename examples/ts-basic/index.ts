/**
 * Reach TypeScript SDK Basic Example
 *
 * This example demonstrates basic usage of the Reach TypeScript SDK.
 *
 * Prerequisites:
 * 1. Reach server running on http://127.0.0.1:8787
 *    Start with: reach serve
 * 2. Dependencies installed
 *    Run: npm install
 *
 * Usage:
 *   npm start
 */

import { createReachClient } from "@reach/sdk";

const client = createReachClient({
  baseUrl: "http://127.0.0.1:8787",
  timeout: 30000,
});

async function main() {
  console.log("=== Reach TypeScript SDK Example ===\n");

  try {
    // 1. Check server health
    console.log("1. Checking server health...");
    const health = await client.health();
    console.log(`   Status: ${health.status}`);
    console.log(`   Version: ${health.version}\n`);

    // 2. Get API version info
    console.log("2. Getting API version...");
    const version = await client.version();
    console.log(`   API Version: ${version.apiVersion}`);
    console.log(`   Spec Version: ${version.specVersion}\n`);

    // 3. Create a new run
    console.log("3. Creating a new run...");
    const run = await client.createRun({
      capabilities: ["tool.read", "tool.write"],
      plan_tier: "free",
    });
    console.log(`   Run ID: ${run.id}`);
    console.log(`   Status: ${run.status}\n`);

    // 4. Get run details
    console.log("4. Getting run details...");
    const runDetails = await client.getRun(run.id);
    console.log(`   Run ID: ${runDetails.id}`);
    console.log(`   Created: ${runDetails.created_at}\n`);

    // 5. Get run events
    console.log("5. Getting run events...");
    const events = await client.getRunEvents(run.id);
    console.log(`   Events count: ${events.events.length}\n`);

    // 6. Search packs
    console.log("6. Searching packs...");
    const packs = await client.searchPacks("demo");
    console.log(`   Found ${packs.results.length} pack(s):`);
    for (const pack of packs.results) {
      console.log(`   - ${pack.name} (verified: ${pack.verified})`);
    }
    console.log();

    // 7. Get federation status
    console.log("7. Getting federation status...");
    const federation = await client.getFederationStatus();
    console.log(`   Nodes: ${federation.nodes.length}\n`);

    console.log("=== Example completed successfully ===");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
