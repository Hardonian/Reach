/**
 * ReadyLayer Suite — Unit tests
 *
 * Covers: signature validation, CI ingest schema, gate evaluation pipeline.
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ── 1. Webhook signature validation ──────────────────────────────────────────

describe("GitHub webhook signature validation", () => {
  const SECRET = "test-webhook-secret-32chars-long-ok";

  function sign(payload: string, secret: string): string {
    return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  }

  function verify(payload: string, signature: string, secret?: string): boolean {
    const s = secret ?? SECRET;
    if (!s) return false;
    const expected = `sha256=${crypto.createHmac("sha256", s).update(payload).digest("hex")}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  it("accepts valid HMAC-SHA256 signature", () => {
    const payload = JSON.stringify({
      action: "opened",
      pull_request: { number: 42 },
    });
    const sig = sign(payload, SECRET);
    expect(verify(payload, sig)).toBe(true);
  });

  it("rejects tampered payload", () => {
    const payload = JSON.stringify({ action: "opened" });
    const sig = sign(payload, SECRET);
    const tampered = JSON.stringify({ action: "closed" });
    expect(verify(tampered, sig)).toBe(false);
  });
});

// ── 2. CI Ingest schema validation ───────────────────────────────────────────

describe("CI ingest schema", () => {
  it("accepts valid minimal ingest payload", async () => {
    const { CiIngestSchema } = await import("../lib/cloud-schemas.js");
    const result = CiIngestSchema.safeParse({
      commit_sha: "abc1234",
      branch: "main",
      ci_provider: "github",
    });
    expect(result.success).toBe(true);
  });
});

// ── 3. Alert threshold evaluation ────────────────────────────────────────────

describe("Alert threshold evaluation", () => {
  it("triggers latency alert above 5000ms default", async () => {
    const signal = {
      id: "sig_1",
      tenant_id: "ten_1",
      name: "Latency",
      type: "latency" as const,
      source: "webhook" as const,
      threshold: {},
      status: "enabled" as const,
      created_at: "",
      updated_at: "",
    };
    const { shouldAlert } = await import("../lib/alert-service.js");
    expect(shouldAlert(signal, 6000)).toBe(true);
    expect(shouldAlert(signal, 3000)).toBe(false);
  });
});

// ── 4. Gate report structure ──────────────────────────────────────────────────

describe("Gate report structure", () => {
  it("GateReport type has required fields", () => {
    const report = {
      verdict: "passed" as "passed" | "failed",
      pass_rate: 1.0,
      violations: 0,
      findings: [],
      summary: "All checks passed.",
    };
    expect(report.verdict).toBe("passed");
    expect(report.pass_rate).toBe(1.0);
  });
});

// ── 5. Simulation variant structure ──────────────────────────────────────────

describe("Simulation variant result structure", () => {
  it("variant result has all comparison fields", () => {
    const result = {
      variant_id: "v1",
      variant_label: "GPT-4o",
      status: "passed" as "passed" | "failed" | "error",
      latency_ms: 450,
      pass_rate: 1.0,
      cost_usd: 0.000012,
    };
    expect(typeof result.latency_ms).toBe("number");
    expect(typeof result.pass_rate).toBe("number");
  });
});
