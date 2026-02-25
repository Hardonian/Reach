import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    surface: "dgl",
    status: "ready",
    tenant_id: ctx.tenantId,
    endpoints: {
      gate_runs: "/api/v1/gates",
      reports: "/api/v1/reports",
    },
  });
}
