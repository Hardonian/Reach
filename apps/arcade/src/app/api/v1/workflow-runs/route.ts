import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { listWorkflowRuns } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
  const runs = listWorkflowRuns(ctx.tenantId, undefined, Math.min(limit, 200));
  return NextResponse.json({ runs });
}
