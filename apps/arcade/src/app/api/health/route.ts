import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getObservabilitySnapshot } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const snapshot = getObservabilitySnapshot();
  return NextResponse.json(
    {
      status: "ok",
      service: "arcade",
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      cloud_enabled: env.REACH_CLOUD_ENABLED === true,
      observability: {
        counters: snapshot.counters,
        last_reconciliation_run_at: snapshot.lastReconciliationRunAt,
        updated_at: snapshot.updatedAt,
      },
    },
    { status: 200 },
  );
}
