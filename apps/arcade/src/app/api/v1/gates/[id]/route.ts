import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { getGate, updateGate, deleteGate, listGateRuns } from "@/lib/cloud-db";
import { UpdateGateSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const gate = getGate(id, ctx.tenantId);
  if (!gate) return cloudErrorResponse("Gate not found", 404);
  const runs = listGateRuns(ctx.tenantId, id, 10);
  return NextResponse.json({ gate, recent_runs: runs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(UpdateGateSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const ok = updateGate(id, ctx.tenantId, parsed.data);
  if (!ok) return cloudErrorResponse("Gate not found", 404);

  auditLog(ctx, "gate.update", "gate", id, parsed.data, req);
  const gate = getGate(id, ctx.tenantId);
  return NextResponse.json({ gate });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;

  const ok = deleteGate(id, ctx.tenantId);
  if (!ok) return cloudErrorResponse("Gate not found", 404);

  auditLog(ctx, "gate.delete", "gate", id, {}, req);
  return NextResponse.json({ deleted: true });
}
