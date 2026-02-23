import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  cloudErrorResponse,
  requireRole,
  auditLog,
} from "@/lib/cloud-auth";
import {
  getSignal,
  updateSignal,
  deleteSignal,
  listMonitorRuns,
} from "@/lib/cloud-db";
import { UpdateSignalSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const signal = getSignal(id, ctx.tenantId);
  if (!signal) return cloudErrorResponse("Signal not found", 404);
  const runs = listMonitorRuns(ctx.tenantId, id, 50);
  return NextResponse.json({ signal, recent_runs: runs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin"))
    return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(UpdateSignalSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(
      parsed.errors.issues[0]?.message ?? "Invalid input",
      400,
    );

  const ok = updateSignal(id, ctx.tenantId, parsed.data);
  if (!ok) return cloudErrorResponse("Signal not found", 404);
  auditLog(ctx, "signal.update", "signal", id, parsed.data, req);
  return NextResponse.json({ signal: getSignal(id, ctx.tenantId) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin"))
    return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;
  const ok = deleteSignal(id, ctx.tenantId);
  if (!ok) return cloudErrorResponse("Signal not found", 404);
  auditLog(ctx, "signal.delete", "signal", id, {}, req);
  return NextResponse.json({ deleted: true });
}
