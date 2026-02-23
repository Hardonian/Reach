import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getProject } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const project = getProject(id, ctx.tenantId);
  if (!project) return cloudErrorResponse("Project not found", 404);
  return NextResponse.json({ project });
}
