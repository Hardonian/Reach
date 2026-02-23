import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { createSignal, listSignals } from "@/lib/cloud-db";
import { CreateSignalSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ signals: listSignals(ctx.tenantId) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateSignalSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const signal = createSignal(ctx.tenantId, parsed.data);
  auditLog(
    ctx,
    "signal.create",
    "signal",
    signal.id,
    { name: signal.name, type: signal.type },
    req,
  );
  return NextResponse.json({ signal }, { status: 201 });
}
