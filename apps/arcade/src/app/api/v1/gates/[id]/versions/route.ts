import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { listGateVersions, getGate } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id: gateId } = await params;
  
  const gate = getGate(gateId, ctx.tenantId);
  if (!gate) return cloudErrorResponse("Gate not found", 404);

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 100);
  const versions = listGateVersions(gateId, ctx.tenantId, limit);
  
  return NextResponse.json({ versions, gate_id: gateId });
}
