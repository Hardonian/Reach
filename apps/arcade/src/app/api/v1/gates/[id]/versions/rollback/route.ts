import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { rollbackGate, getGate } from "@/lib/cloud-db";
import { z } from "zod";

export const runtime = "nodejs";

const RollbackSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);

  const { id: gateId } = await params;
  
  const gate = getGate(gateId, ctx.tenantId);
  if (!gate) return cloudErrorResponse("Gate not found", 404);

  const body = await req.json().catch(() => ({}));
  const parsed = RollbackSchema.safeParse(body);
  
  if (!parsed.success) {
    return cloudErrorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { version, reason } = parsed.data;
  
  const success = rollbackGate(gateId, ctx.tenantId, version, reason, ctx.userId);
  
  if (!success) {
    return cloudErrorResponse("Failed to rollback - version not found", 400);
  }

  auditLog(ctx, "gate.rollback", "gate", gateId, { 
    target_version: version, 
    reason,
    gate_name: gate.name 
  }, req);

  return NextResponse.json({ 
    success: true, 
    message: `Gate rolled back to version ${version}`,
    gate_id: gateId,
    target_version: version,
  });
}
