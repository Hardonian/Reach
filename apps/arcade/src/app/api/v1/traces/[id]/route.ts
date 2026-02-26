import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id: traceId } = await params;
  const db = getDB();

  const trace = db.prepare(`
    SELECT 
      t.*,
      w.name as workflow_name,
      g.name as gate_name
    FROM traces t
    LEFT JOIN workflows w ON t.workflow_id = w.id
    LEFT JOIN gates g ON t.gate_id = g.id
    WHERE t.id = ? AND t.tenant_id = ?
  `).get(traceId, ctx.tenantId) as any;

  if (!trace) {
    return cloudErrorResponse("Trace not found", 404);
  }

  // Get steps
  const steps = db.prepare(`
    SELECT * FROM trace_steps 
    WHERE trace_id = ? 
    ORDER BY step_number ASC
  `).all(traceId) as any[];

  return NextResponse.json({
    trace: {
      ...trace,
      steps: steps.map(s => ({
        ...s,
        metadata: s.metadata ? JSON.parse(s.metadata) : undefined,
      })),
      duration_ms: trace.finished_at 
        ? new Date(trace.finished_at).getTime() - new Date(trace.started_at).getTime()
        : undefined,
    },
  });
}
