/**
 * Public read-only report share endpoint.
 * No authentication required — just a valid (non-expired) share slug.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getReportShareBySlug,
  getGateRun,
  getScenarioRun,
} from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  const share = getReportShareBySlug(slug);
  if (!share) {
    return NextResponse.json(
      { error: "Share link not found or expired" },
      { status: 404 },
    );
  }

  const { resource_type, resource_id, tenant_id } = share;

  if (resource_type === "gate_run") {
    const gateRun = getGateRun(resource_id, tenant_id);
    if (!gateRun)
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({
      type: "gate_run",
      id: gateRun.id,
      status: gateRun.status,
      report: gateRun.report,
      created_at: gateRun.created_at,
      finished_at: gateRun.finished_at,
      share_expires_at: share.expires_at,
    });
  }

  if (resource_type === "scenario_run") {
    const scenarioRun = getScenarioRun(resource_id, tenant_id);
    if (!scenarioRun)
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({
      type: "scenario_run",
      id: scenarioRun.id,
      status: scenarioRun.status,
      results: scenarioRun.results,
      recommendation: scenarioRun.recommendation,
      created_at: scenarioRun.created_at,
      finished_at: scenarioRun.finished_at,
      share_expires_at: share.expires_at,
    });
  }

  return NextResponse.json({ error: "Unknown resource type" }, { status: 400 });
}
