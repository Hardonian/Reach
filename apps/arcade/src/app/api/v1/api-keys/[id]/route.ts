import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { revokeApiKey } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);
  const { id } = await params;
  const ok = revokeApiKey(id, ctx.tenantId);
  if (!ok) return cloudErrorResponse("API key not found", 404);
  auditLog(ctx, "api_key.revoke", "api_key", id, {}, req);
  return NextResponse.json({ ok: true });
}
