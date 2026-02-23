import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { getScenario, updateScenario, deleteScenario, listScenarioRuns } from "@/lib/cloud-db";
import { UpdateScenarioSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const scenario = getScenario(id, ctx.tenantId);
  if (!scenario) return cloudErrorResponse("Scenario not found", 404);
  const runs = listScenarioRuns(ctx.tenantId, id, 10);
  return NextResponse.json({ scenario, recent_runs: runs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(UpdateScenarioSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const ok = updateScenario(id, ctx.tenantId, parsed.data);
  if (!ok) return cloudErrorResponse("Scenario not found", 404);
  auditLog(ctx, "scenario.update", "scenario", id, parsed.data, req);
  return NextResponse.json({ scenario: getScenario(id, ctx.tenantId) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;
  const ok = deleteScenario(id, ctx.tenantId);
  if (!ok) return cloudErrorResponse("Scenario not found", 404);
  auditLog(ctx, "scenario.delete", "scenario", id, {}, req);
  return NextResponse.json({ deleted: true });
}
