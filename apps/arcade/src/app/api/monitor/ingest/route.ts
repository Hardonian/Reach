/**
 * Monitor Ingest — accepts telemetry from agent runtimes and SDKs.
 *
 * POST /api/monitor/ingest
 * Auth: Bearer token with scope "ingest_runs"
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCiAuth } from "@/lib/cloud-auth";
import { getSignal, createMonitorRun } from "@/lib/cloud-db";
import { MonitorIngestSchema, parseBody } from "@/lib/cloud-schemas";
import { shouldAlert, dispatchAlerts } from "@/lib/alert-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireCiAuth(req, "ingest_runs");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(MonitorIngestSchema, body);
  if ("errors" in parsed) {
    return NextResponse.json(
      { error: parsed.errors.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { signal_id, value, metadata } = parsed.data;

  const signal = getSignal(signal_id, ctx.tenantId);
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }
  if (signal.status === "disabled") {
    return NextResponse.json({ skipped: true, reason: "Signal is disabled" });
  }

  const alertTriggered = shouldAlert(signal, value);
  const monitorRun = createMonitorRun(
    ctx.tenantId,
    signal_id,
    value,
    metadata,
    alertTriggered,
  );

  // Dispatch alerts asynchronously
  if (alertTriggered) {
    void dispatchAlerts(ctx.tenantId, signal, monitorRun).catch(() => {});
  }

  return NextResponse.json(
    {
      monitor_run_id: monitorRun.id,
      alert_triggered: alertTriggered,
      created_at: monitorRun.created_at,
    },
    { status: 201 },
  );
}
