import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    surface: "cpx",
    status: "ready",
    tenant_id: ctx.tenantId,
    endpoints: {
      arbitration: "/api/v1/scenarios",
      reports: "/api/v1/reports",
    },
  });
}
