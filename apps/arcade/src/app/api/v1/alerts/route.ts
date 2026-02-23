import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from "@/lib/cloud-auth";
import { createAlertRule, listAlertRules } from "@/lib/cloud-db";
import { CreateAlertRuleSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ alert_rules: listAlertRules(ctx.tenantId) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, "admin")) return cloudErrorResponse("Insufficient permissions", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateAlertRuleSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  const rule = createAlertRule(ctx.tenantId, parsed.data);
  auditLog(
    ctx,
    "alert_rule.create",
    "alert_rule",
    rule.id,
    { name: rule.name, channel: rule.channel },
    req,
  );
  return NextResponse.json({ alert_rule: rule }, { status: 201 });
}
