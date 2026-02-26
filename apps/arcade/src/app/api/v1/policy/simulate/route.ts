import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { resourceType, resourceId, proposedConfig, lookbackRuns = 10 } = body;
  if (!resourceType || !proposedConfig) return cloudErrorResponse("Missing required fields", 400);

  const db = getDB();
  const recentRuns = db.prepare(`SELECT id, status, outputs_json FROM workflow_runs WHERE tenant_id = ? AND workflow_id = ? ORDER BY started_at DESC LIMIT ?`).all(ctx.tenantId, resourceId, lookbackRuns) as any[];

  const results = recentRuns.map(run => {
    const outputs = JSON.parse(run.outputs_json || '{}');
    const simulated = simulatePolicy(proposedConfig, outputs);
    return { runId: run.id, originalStatus: run.status, simulatedStatus: simulated.status, wouldChange: run.status !== simulated.status, reason: simulated.reason };
  });

  return NextResponse.json({ simulation: { summary: { total: results.length, changes: results.filter(r => r.wouldChange).length }, results } });
}

function simulatePolicy(config: any, outputs: any): { status: string; reason: string } {
  if (config.thresholds?.pass_rate && outputs.pass_rate < config.thresholds.pass_rate) {
    return { status: 'blocked', reason: `Pass rate ${outputs.pass_rate} below threshold ${config.thresholds.pass_rate}` };
  }
  return { status: 'allowed', reason: 'All checks passed' };
}
