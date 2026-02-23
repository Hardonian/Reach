import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getGate, createGateRun } from "@/lib/cloud-db";
import { TriggerGateRunSchema, parseBody } from "@/lib/cloud-schemas";
import { runGate } from "@/lib/gate-engine";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const gate = getGate(id, ctx.tenantId);
  if (!gate) return cloudErrorResponse("Gate not found", 404);
  if (gate.status === "disabled")
    return cloudErrorResponse("Gate is disabled", 400);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(TriggerGateRunSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(
      parsed.errors.issues[0]?.message ?? "Invalid input",
      400,
    );

  const gateRun = createGateRun(ctx.tenantId, id, parsed.data);
  auditLog(
    ctx,
    "gate_run.create",
    "gate_run",
    gateRun.id,
    { gate_id: id, trigger_type: parsed.data.trigger_type },
    req,
  );

  // Execute gate asynchronously — fire and forget, then return the run ID
  // The client polls /api/v1/reports/:gateRunId or the UI uses the run ID
  void runGate(ctx.tenantId, gateRun.id).catch((err) => {
    console.error("Gate run failed", {
      gate_run_id: gateRun.id,
      err: String(err),
    });
  });

  return NextResponse.json(
    {
      gate_run: {
        id: gateRun.id,
        status: gateRun.status,
        created_at: gateRun.created_at,
      },
      report_url: `/reports/${gateRun.id}`,
      message: "Gate evaluation started. Check report_url for results.",
    },
    { status: 202 },
  );
}
