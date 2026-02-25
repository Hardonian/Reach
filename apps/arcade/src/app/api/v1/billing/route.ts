import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";
import { getEntitlement, checkRunLimit } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const ent = getEntitlement(ctx.tenantId);
  const limits = checkRunLimit(ctx.tenantId);

  return NextResponse.json({
    plan: ent?.plan ?? "free",
    status: ent?.status ?? "active",
    stripe_customer_id: ent?.stripe_customer_id ?? null,
    has_active_subscription: !!(ent?.stripe_subscription_id && ent?.status === "active"),
    usage: {
      runs_used: limits.used,
      runs_limit: limits.limit,
      runs_remaining: limits.limit === -1 ? null : Math.max(0, limits.limit - limits.used),
    },
    limits: {
      runs_per_month: ent?.runs_per_month ?? 100,
      pack_limit: ent?.pack_limit ?? 5,
      retention_days: ent?.retention_days ?? 7,
    },
    period_start: ent?.period_start ?? null,
    period_end: ent?.period_end ?? null,
  });
}
