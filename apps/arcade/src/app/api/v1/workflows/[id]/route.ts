import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  cloudErrorResponse,
  requireRole,
  auditLog,
} from "@/lib/cloud-auth";
import { getWorkflow, updateWorkflow } from "@/lib/cloud-db";
import { UpdateWorkflowSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const wf = getWorkflow(id, ctx.tenantId);
  if (!wf) return cloudErrorResponse("Workflow not found", 404);
  return NextResponse.json({
    workflow: { ...wf, graph: JSON.parse(wf.graph_json) },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "member"))
    return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(UpdateWorkflowSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(
      parsed.errors.issues[0]?.message ?? "Invalid input",
      400,
    );

  const patch = {
    name: parsed.data.name,
    description: parsed.data.description,
    graphJson: parsed.data.graph
      ? JSON.stringify(parsed.data.graph)
      : undefined,
    status: parsed.data.status,
  };
  const ok = updateWorkflow(id, ctx.tenantId, patch);
  if (!ok) return cloudErrorResponse("Workflow not found", 404);
  auditLog(
    ctx,
    "workflow.update",
    "workflow",
    id,
    {
      patch: Object.keys(patch).filter(
        (k) => patch[k as keyof typeof patch] !== undefined,
      ),
    },
    req,
  );
  const wf = getWorkflow(id, ctx.tenantId)!;
  return NextResponse.json({
    workflow: { ...wf, graph: JSON.parse(wf.graph_json) },
  });
}
