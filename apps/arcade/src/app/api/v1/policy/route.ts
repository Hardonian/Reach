import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    surface: "policy",
    status: "ready",
    tenant_id: ctx.tenantId,
    endpoints: {
      governance_assistant: "/api/v1/governance/assistant",
      governance_memory: "/api/v1/governance/memory",
      gates: "/api/v1/gates",
      signals: "/api/v1/signals",
    },
  });
}
