import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse } from '@/lib/cloud-auth';
import { getEntitlement } from '@/lib/cloud-db';
import { createCheckoutSession, BillingDisabledError } from '@/lib/stripe';
import { CheckoutSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  if (process.env.BILLING_ENABLED !== 'true') {
    return cloudErrorResponse('Billing is not enabled on this instance. Set BILLING_ENABLED=true and STRIPE_SECRET_KEY.', 503);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CheckoutSchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.errors.errors[0]?.message ?? 'Invalid input', 400);

  try {
    const ent = getEntitlement(ctx.tenantId);
    const session = await createCheckoutSession({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      email: ctx.user.email,
      priceId: parsed.data.priceId,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
      existingCustomerId: ent?.stripe_customer_id ?? undefined,
    });
    return NextResponse.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    if (err instanceof BillingDisabledError) return cloudErrorResponse(err.message, 503);
    console.error('[billing/checkout]', err);
    return cloudErrorResponse('Failed to create checkout session', 500);
  }
}
