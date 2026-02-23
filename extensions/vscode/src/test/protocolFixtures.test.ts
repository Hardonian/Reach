import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function fixture(name: string): Record<string, unknown> {
  const file = path.resolve(__dirname, "../../../../protocol/examples", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

describe("protocol fixture contracts", () => {
  it("parses all golden fixtures with schemaVersion", () => {
    const names = [
      "spawn_event.json",
      "guardrail_stop.json",
      "session_started.json",
      "capsule_sync.json",
    ];
    for (const name of names) {
      const event = fixture(name);
      expect(event.schemaVersion).toBe("1.0.0");
      expect(typeof event.eventId).toBe("string");
      expect(typeof event.type).toBe("string");
      expect(event.payload).toBeTypeOf("object");
      expect((event.payload as Record<string, unknown>).schemaVersion).toBe(
        "1.0.0",
      );
    }
  });
});
