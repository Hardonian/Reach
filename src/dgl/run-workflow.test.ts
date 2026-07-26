import { describe, expect, it } from "vitest";
import { runStatus } from "./run-workflow.js";

describe("governed run workflow", () => {
  it("derives failed status from error violations", () => {
    expect(runStatus({ run_id: "r1", timestamp: "t", violations: [{ severity: "error" }] })).toBe("failed");
    expect(runStatus({ run_id: "r2", timestamp: "t", violations: [{ severity: "warning" }] })).toBe("passed");
  });
});
