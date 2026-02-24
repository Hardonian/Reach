import { Command } from "commander";
import { loadConfig } from "../../core/env.js";

export const doctor = new Command("doctor");

doctor
  .description("Check system health and configuration")
  .action(() => {
    console.log("Reach System Health Check");
    console.log("=========================");

    try {
      const config = loadConfig();

      console.log("\nEnvironment:");
      console.log(`  NODE_ENV:         ${config.NODE_ENV}`);
      console.log(`  CI:               ${config.CI}`);
      console.log(`  DEBUG:            ${config.DEBUG}`);

      console.log("\nPlatform:");
      console.log(`  ZEO_STRICT:       ${config.ZEO_STRICT}`);
      console.log(`  ZEO_WORKSPACE_ID: ${config.ZEO_WORKSPACE_ID}`);
      if (config.ZEO_FIXED_TIME) {
        console.log(`  ZEO_FIXED_TIME:   ${config.ZEO_FIXED_TIME}`);
      }
      if (config.ZEO_PLUGIN_PATH) {
        console.log(`  ZEO_PLUGIN_PATH:  ${config.ZEO_PLUGIN_PATH}`);
      }

      console.log("\nControl Plane:");
      console.log(`  ZEO_MODEL:        ${config.ZEO_MODEL} (${config.ZEO_PROVIDER})`);
      console.log(`  KEYS_PROVIDER:    ${config.KEYS_PROVIDER}`);

      if (config.ZEO_PROVIDER !== "local") {
        const hasKey =
          config.OPENAI_API_KEY ||
          config.ANTHROPIC_API_KEY ||
          config.OPENROUTER_API_KEY ||
          config.ZEO_LLM_API_KEY;

        if (!hasKey) {
          console.log(`\n⚠️  Warning: ZEO_PROVIDER is '${config.ZEO_PROVIDER}' but no API keys found.`);
          console.log("    Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY.");
        }
      }

      console.log("\nObservability:");
      console.log(`  LOG_FORMAT:       ${config.ZEO_LOG_FORMAT}`);
      console.log(`  LOG_REDACT:       ${config.ZEO_LOG_REDACT}`);

      console.log("\nStatus:");
      console.log("  ✅ Configuration loaded");

      // Additional runtime checks can be added here (e.g. connectivity)

    } catch (err: any) {
      console.error(`\n❌ Health check failed: ${err.message}`);
      process.exit(1);
    }
  });
