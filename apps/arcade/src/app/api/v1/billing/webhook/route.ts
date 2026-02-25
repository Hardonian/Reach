/**
 * Stripe Webhook Handler
 *
 * CRITICAL: uses raw body for signature verification.
 * Must run on Node.js runtime (NOT edge).
 * Idempotency: upsertWebhookEvent deduplicates by stripe_event_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, getPlanForPriceId, BillingDisabledError } from "@/lib/stripe";
import {
  upsertWebhookEvent,
  markWebhookProcessed,
  upsertEntitlement,
  PLAN_LIMITS,
} from "@/lib/cloud-db";
import { appendAudit } from "@/lib/db/ops";
// @ts-ignore
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Next.js App Router: disable body parsing so we can read raw bytes
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (env.BILLING_ENABLED !== true) {
    return NextResponse.json({ error: "Billing not enabled" }, { status: 503 });
  }

  // ── Read raw body ──────────────────────────────────────────────────────
  const rawBody = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // ── Verify signature ───────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig);
  } catch (err) {
    logger.error("Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotency check ──────────────────────────────────────────────────
  const isNew = upsertWebhookEvent(event.id, event.type, JSON.stringify(event));
  if (!isNew) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // ── Handle event ───────────────────────────────────────────────────────
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      ?? req.headers.get("x-real-ip") 
      ?? "unknown";
    await handleStripeEvent(event, clientIp);
    markWebhookProcessed(event.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BillingDisabledError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    // Log error with event context for debugging - event was stored but not processed
    logger.error("Webhook handler error", {
      error: err,
      eventId: event.id,
      eventType: event.type,
    });
    // Return 500 to trigger Stripe retry - event is stored (idempotent) but processing failed
    return NextResponse.json(
      { ok: false, error: "Handler error, event stored but not processed" },
      { status: 500 }
    );
  }
}

async function handleStripeEvent(event: Stripe.Event, clientIp: string): Promise<void> {
  const data = event.data.object as unknown as Record<string, unknown>;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = data as unknown as Stripe.Subscription;
      const tenantId = (sub.metadata?.["tenant_id"] as string) ?? "";
      if (!tenantId) {
        logger.warn("no tenant_id in subscription metadata");
        return;
      }
      const priceId = (sub.items?.data?.[0]?.price?.id as string) ?? "";
      const plan = getPlanForPriceId(priceId);
      const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS["pro"];
      const firstItem = sub.items?.data?.[0];
      upsertEntitlement(tenantId, {
        plan,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        status: sub.status === "active" ? "active" : sub.status,
        runs_per_month: limits.runs_per_month,
        pack_limit: limits.pack_limit,
        retention_days: limits.retention_days,
        period_start: firstItem?.current_period_start
          ? new Date(firstItem.current_period_start * 1000).toISOString()
          : undefined,
        period_end: firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : undefined,
      } as Parameters<typeof upsertEntitlement>[1]);
      
      // Audit trail for subscription created/updated
      appendAudit(
        tenantId,
        null,
        "stripe.webhook.subscription.updated",
        "subscription",
        sub.id,
        {
          event_type: event.type,
          plan,
          status: sub.status,
          price_id: priceId,
          customer_id: sub.customer,
        },
        clientIp,
      );
      logger.info(`Subscription ${event.type} processed`, { tenantId, plan });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = data as unknown as Stripe.Subscription;
      const tenantId = (sub.metadata?.["tenant_id"] as string) ?? "";
      if (!tenantId) return;
      upsertEntitlement(tenantId, {
        plan: "free",
        stripe_subscription_id: null,
        stripe_price_id: null,
        status: "canceled",
        runs_per_month: PLAN_LIMITS["free"].runs_per_month,
        pack_limit: PLAN_LIMITS["free"].pack_limit,
        retention_days: PLAN_LIMITS["free"].retention_days,
      } as Parameters<typeof upsertEntitlement>[1]);
      
      // Audit trail for subscription deleted
      appendAudit(
        tenantId,
        null,
        "stripe.webhook.subscription.deleted",
        "subscription",
        sub.id,
        {
          event_type: event.type,
          customer_id: sub.customer,
        },
        clientIp,
      );
      logger.info("Subscription canceled", { tenantId });
      break;
    }

    case "invoice.paid": {
      const invoice = data as unknown as Stripe.Invoice;
      const tenantId =
        (invoice.parent?.subscription_details?.metadata?.["tenant_id"] as string) ?? "";
      if (tenantId) {
        // Reset monthly usage on successful invoice payment (new billing period)
        const { resetMonthlyUsage } = await import("@/lib/cloud-db");
        resetMonthlyUsage(tenantId);
        
        // Audit trail for invoice paid (usage reset)
        appendAudit(
          tenantId,
          null,
          "stripe.webhook.invoice.paid",
          "invoice",
          invoice.id,
          {
            event_type: event.type,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            customer_id: invoice.customer,
            subscription_id: invoice.subscription,
          },
          clientIp,
        );
        logger.info("Invoice paid — reset usage", { tenantId });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = data as unknown as Stripe.Invoice;
      const tenantId =
        (invoice.parent?.subscription_details?.metadata?.["tenant_id"] as string) ?? "";
      if (tenantId) {
        upsertEntitlement(tenantId, { status: "past_due" } as Parameters<
          typeof upsertEntitlement
        >[1]);
        
        // Audit trail for payment failed
        appendAudit(
          tenantId,
          null,
          "stripe.webhook.invoice.payment_failed",
          "invoice",
          invoice.id,
          {
            event_type: event.type,
            amount_due: invoice.amount_due,
            currency: invoice.currency,
            customer_id: invoice.customer,
            subscription_id: invoice.subscription,
          },
          clientIp,
        );
        logger.warn("Invoice payment failed", { tenantId });
      }
      break;
    }

    default:
      // Unhandled event types: just log
      logger.info("Unhandled Stripe event", { type: event.type });
  }
}
