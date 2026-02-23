import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { createWorkflow, listWorkflows } from "@/lib/cloud-db";
import { CreateWorkflowSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const projectId = req.nextUrl.searchParams.get("project_id") ?? undefined;
  const workflows = listWorkflows(ctx.tenantId, projectId);
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "member")) return cloudErrorResponse("Insufficient permissions", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateWorkflowSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const graphJson = parsed.data.graph
    ? JSON.stringify(parsed.data.graph)
    : JSON.stringify({
        nodes: [],
        edges: [],
        triggers: [{ type: "manual" }],
        policies: [],
        version: 1,
      });
  const workflow = createWorkflow(
    ctx.tenantId,
    parsed.data.projectId ?? null,
    parsed.data.name,
    parsed.data.description,
    ctx.userId,
    graphJson,
  );
  auditLog(ctx, "workflow.create", "workflow", workflow.id, { name: workflow.name }, req);
  return NextResponse.json(
    { workflow: { ...workflow, graph: JSON.parse(workflow.graph_json) } },
    { status: 201 },
  );
}
