import { NextResponse } from "next/server";
import { getDB, isCloudEnabled } from "@/lib/db/connection";
import { getObservabilitySnapshot } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const snapshot = getObservabilitySnapshot();

  if (!isCloudEnabled()) {
    return NextResponse.json(
      {
        ready: true,
        mode: "degraded",
        reason: "cloud_disabled",
        timestamp: new Date().toISOString(),
        last_reconciliation_run_at: snapshot.lastReconciliationRunAt,
      },
      { status: 200 },
    );
  }

  try {
    const db = getDB();
    db.prepare("SELECT 1").get();
    return NextResponse.json(
      {
        ready: true,
        mode: "full",
        cloud_db: "ok",
        timestamp: new Date().toISOString(),
        last_reconciliation_run_at: snapshot.lastReconciliationRunAt,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ready: false,
        mode: "degraded",
        cloud_db: "unreachable",
        timestamp: new Date().toISOString(),
        error: "cloud_db_unreachable",
      },
      { status: 503 },
    );
  }
}
