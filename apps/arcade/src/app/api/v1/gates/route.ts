import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { createGate, listGates } from "@/lib/cloud-db";
import { CreateGateSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const gates = listGates(ctx.tenantId);
  return NextResponse.json({ gates });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateGateSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const gate = createGate(ctx.tenantId, parsed.data);
  auditLog(
    ctx,
    "gate.create",
    "gate",
    gate.id,
    { name: gate.name, repo: `${gate.repo_owner}/${gate.repo_name}` },
    req,
  );
  return NextResponse.json({ gate }, { status: 201 });
}
