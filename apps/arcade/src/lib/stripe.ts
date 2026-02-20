/**
 * Reach Cloud — Stripe integration.
 *
 * Only active when BILLING_ENABLED=true and STRIPE_SECRET_KEY is set.
 * Falls back gracefully when disabled.
 */
import Stripe from 'stripe';
import { env } from './env';

export class BillingDisabledError extends Error {
  constructor() { super('BILLING_ENABLED is not set or STRIPE_SECRET_KEY is missing.'); }
}

function isBillingEnabled(): boolean {
  return env.BILLING_ENABLED === true && !!env.STRIPE_SECRET_KEY;
}

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!isBillingEnabled()) throw new BillingDisabledError();
  if (_stripe) return _stripe;
  _stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-01-27.acacia',
  });
  return _stripe;
}

// ── Plan → Price ID mapping ────────────────────────────────────────────────
// Set these env vars to real Stripe Price IDs:
//   STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, STRIPE_PRICE_ENTERPRISE
export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  pro:        env.STRIPE_PRICE_PRO,
  team:       env.STRIPE_PRICE_TEAM,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
};

export function getPlanForPriceId(priceId: string): string {
  for (const [plan, pid] of Object.entries(PLAN_PRICE_IDS)) {
    if (pid === priceId) return plan;
  }
  return 'pro'; // default fallback
}

// ── Checkout session ───────────────────────────────────────────────────────
export async function createCheckoutSession(opts: {
  tenantId: string;
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: opts.existingCustomerId,
    customer_email: opts.existingCustomerId ? undefined : opts.email,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: {
      metadata: { tenant_id: opts.tenantId, user_id: opts.userId },
    },
    metadata: { tenant_id: opts.tenantId, user_id: opts.userId },
    allow_promotion_codes: true,
  });
  return session;
}

// ── Customer portal ────────────────────────────────────────────────────────
export async function createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

// ── Webhook signature verification ─────────────────────────────────────────
export function constructWebhookEvent(rawBody: Buffer, sig: string): Stripe.Event {
  const stripe = getStripe();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  return stripe.webhooks.constructEvent(rawBody, sig, secret);
}
