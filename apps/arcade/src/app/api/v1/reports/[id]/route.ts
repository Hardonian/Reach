/**
 * Canonical Report endpoint.
 *
 * Resolves a report ID to the underlying resource (gate_run, scenario_run).
 * Works for both authenticated users and public share links.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getGateRun, getScenarioRun } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  // Try gate run first
  const gateRun = getGateRun(id, ctx.tenantId);
  if (gateRun) {
    return NextResponse.json({
      type: "gate_run",
      id: gateRun.id,
      status: gateRun.status,
      trigger_type: gateRun.trigger_type,
      commit_sha: gateRun.commit_sha,
      pr_number: gateRun.pr_number,
      branch: gateRun.branch,
      report: gateRun.report,
      created_at: gateRun.created_at,
      finished_at: gateRun.finished_at,
    });
  }

  // Try scenario run
  const scenarioRun = getScenarioRun(id, ctx.tenantId);
  if (scenarioRun) {
    return NextResponse.json({
      type: "scenario_run",
      id: scenarioRun.id,
      status: scenarioRun.status,
      results: scenarioRun.results,
      recommendation: scenarioRun.recommendation,
      created_at: scenarioRun.created_at,
      finished_at: scenarioRun.finished_at,
    });
  }

  return cloudErrorResponse("Report not found", 404);
}
