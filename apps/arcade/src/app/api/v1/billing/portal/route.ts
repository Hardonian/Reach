import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getEntitlement } from "@/lib/cloud-db";
import { createPortalSession, BillingDisabledError } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const ent = getEntitlement(ctx.tenantId);
  if (!ent?.stripe_customer_id) {
    return cloudErrorResponse(
      "No active subscription. Start a checkout session first.",
      400,
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      return_url?: string;
    };
    const returnUrl = body.return_url ?? `${req.nextUrl.origin}/cloud/billing`;
    const portal = await createPortalSession(ent.stripe_customer_id, returnUrl);
    return NextResponse.json({ portal_url: portal.url });
  } catch (err) {
    if (err instanceof BillingDisabledError)
      return cloudErrorResponse(err.message, 503);
    logger.error("Failed to create portal session", err);
    return cloudErrorResponse("Failed to create portal session", 500);
  }
}
