import { randomUUID } from "node:crypto";
import { hashString } from "../determinism/index.js";

export type RedactMode = "off" | "safe" | "strict";

export interface CliLogEvent {
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  msg: string;
  run_id: string;
  trace_id: string;
  cmd?: string;
  action?: string;
  duration_ms?: number;
  cache_hit?: boolean;
  model?: string;
  provider?: string;
  error_code?: string;
  schema_version: "zeo.log.v1";
  [key: string]: unknown;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function createRunContext() {
  const run_id = randomUUID();
  const trace_id = randomUUID();
  const started = Date.now();
  return { run_id, trace_id, started };
}

function redact(v: unknown, mode: RedactMode): unknown {
  if (mode === "off") return v;
  if (typeof v === "string") return v.replace(EMAIL, "[REDACTED_EMAIL]");
  if (Array.isArray(v)) return v.map((x) => redact(x, mode));
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.toLowerCase();
    if (
      ["token", "authorization", "api_key", "prompt", "transcript", "secret", "password"].some(
        (x) => key.includes(x),
      )
    ) {
      const str = typeof val === "string" ? val : JSON.stringify(val);
      out[k] = {
        redacted: true,
        sha256: hashString(str),
        preview: mode === "strict" ? "" : str.slice(0, 24),
      };
    } else {
      out[k] = redact(val, mode);
    }
  }
  return out;
}

export function log(event: Omit<CliLogEvent, "ts" | "schema_version">): void {
  const mode = (process.env.ZEO_LOG_REDACT as RedactMode) || "safe";
  const payload = {
    ...event,
    ts: new Date().toISOString(),
    schema_version: "zeo.log.v1",
  } as CliLogEvent;
  const safe = redact(payload, mode);
  const asJson = process.env.ZEO_LOG_FORMAT === "json" || process.env.CI === "true";
  if (asJson) {
    process.stderr.write(`${JSON.stringify(safe).slice(0, 8192)}\n`);
  } else {
    const e = safe as CliLogEvent;
    process.stderr.write(`[${e.level}] ${e.msg} run=${e.run_id} trace=${e.trace_id}\n`);
  }
}
