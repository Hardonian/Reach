import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  cloudErrorResponse,
  requireRole,
  auditLog,
} from "@/lib/cloud-auth";
import { updateAlertRule, deleteAlertRule } from "@/lib/cloud-db";
import { UpdateAlertRuleSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

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
  const parsed = parseBody(UpdateAlertRuleSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(
      parsed.errors.issues[0]?.message ?? "Invalid input",
      400,
    );

  const ok = updateAlertRule(id, ctx.tenantId, parsed.data);
  if (!ok) return cloudErrorResponse("Alert rule not found", 404);
  auditLog(ctx, "alert_rule.update", "alert_rule", id, parsed.data, req);
  return NextResponse.json({ updated: true });
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

  const ok = deleteAlertRule(id, ctx.tenantId);
  if (!ok) return cloudErrorResponse("Alert rule not found", 404);
  auditLog(ctx, "alert_rule.delete", "alert_rule", id, {}, req);
  return NextResponse.json({ deleted: true });
}
