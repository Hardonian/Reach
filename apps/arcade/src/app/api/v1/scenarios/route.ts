import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { createScenario, listScenarios } from "@/lib/cloud-db";
import { CreateScenarioSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ scenarios: listScenarios(ctx.tenantId) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateScenarioSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(
      parsed.errors.issues[0]?.message ?? "Invalid input",
      400,
    );

  const scenario = createScenario(ctx.tenantId, parsed.data);
  auditLog(
    ctx,
    "scenario.create",
    "scenario",
    scenario.id,
    { name: scenario.name },
    req,
  );
  return NextResponse.json({ scenario }, { status: 201 });
}
