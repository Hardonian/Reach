import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getWorkflowRun } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const run = getWorkflowRun(id, ctx.tenantId);
  if (!run) return cloudErrorResponse("Run not found", 404);
  return NextResponse.json({
    run: {
      ...run,
      inputs: JSON.parse(run.inputs_json),
      outputs: JSON.parse(run.outputs_json),
      metrics: JSON.parse(run.metrics_json),
    },
  });
}
