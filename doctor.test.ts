import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { doctor } from "../../src/cli/commands/doctor.js";
import { resetConfigCache } from "../../src/core/env.js";

describe("doctor command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    resetConfigCache();

    // Reset relevant env vars
    delete process.env.ZEO_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ZEO_LLM_API_KEY;
    delete process.env.PORT;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs basic health information", async () => {
    await doctor.parseAsync(["node", "reach-doctor"]);

    expect(console.log).toHaveBeenCalledWith("Reach System Health Check");
    expect(console.log).toHaveBeenCalledWith("=========================");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("NODE_ENV:"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("✅ Configuration loaded"));
  });

  it("warns when ZEO_PROVIDER is not local and keys are missing", async () => {
    process.env.ZEO_PROVIDER = "openai";

    await doctor.parseAsync(["node", "reach-doctor"]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("⚠️  Warning: ZEO_PROVIDER is 'openai' but no API keys found."));
  });

  it("does not warn when ZEO_PROVIDER is local", async () => {
    process.env.ZEO_PROVIDER = "local";

    await doctor.parseAsync(["node", "reach-doctor"]);

    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("⚠️  Warning: ZEO_PROVIDER"));
  });

  it("exits with error on invalid configuration", async () => {
    process.env.PORT = "invalid-port";

    await doctor.parseAsync(["node", "reach-doctor"]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Health check failed: PORT must be a valid number"));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("correctly reports DEBUG status when enabled", async () => {
    process.env.DEBUG = "true";

    await doctor.parseAsync(["node", "reach-doctor"]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("DEBUG:            true"));
  });
});
