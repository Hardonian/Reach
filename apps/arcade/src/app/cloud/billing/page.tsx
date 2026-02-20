'use client';

import { useEffect, useState } from 'react';

interface BillingInfo {
  plan: string; status: string; stripe_customer_id: string | null;
  has_active_subscription: boolean;
  usage: { runs_used: number; runs_limit: number; runs_remaining: number | null };
  limits: { runs_per_month: number; pack_limit: number; retention_days: number };
  period_start: string | null; period_end: string | null;
}

const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0/mo',
    features: ['100 workflow runs/month', '5 pack limit', '7-day retention', 'Community support'],
  },
  {
    id: 'pro', name: 'Pro', price: 'From $29/mo',
    features: ['10,000 workflow runs/month', '100 packs', '90-day retention', 'Priority support', 'Custom domains'],
    highlighted: true,
  },
  {
    id: 'team', name: 'Team', price: 'From $99/mo',
    features: ['50,000 workflow runs/month', '500 packs', '180-day retention', 'Multi-seat', 'SSO (coming soon)'],
  },
];

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState('');

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}) };

  useEffect(() => {
    fetch('/api/v1/billing', { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d: BillingInfo) => setBilling(d))
      .finally(() => setLoading(false));
  }, []);

  async function startCheckout(priceId: string) {
    setCheckoutLoading(priceId);
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/cloud/billing?success=1`,
          cancelUrl: `${window.location.origin}/cloud/billing`,
        }),
      });
      const data = await res.json() as { checkout_url?: string; error?: string };
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert(data.error ?? 'Checkout unavailable. Set BILLING_ENABLED=true and Stripe keys to enable.');
      }
    } finally {
      setCheckoutLoading('');
    }
  }

  async function openPortal() {
    const res = await fetch('/api/v1/billing/portal', { method: 'POST', headers });
    const data = await res.json() as { portal_url?: string; error?: string };
    if (data.portal_url) window.location.href = data.portal_url;
    else alert(data.error ?? 'Portal unavailable.');
  }

  if (loading) return <div className="p-8 text-gray-400">Loading billing info...</div>;

  const usagePct = billing && billing.limits.runs_per_month > 0
    ? Math.min(100, (billing.usage.runs_used / billing.limits.runs_per_month) * 100)
    : 0;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Billing</h1>
      <p className="text-gray-400 mb-8">Manage your plan and usage</p>

      {/* Current plan */}
      {billing && (
        <div className="mb-8 p-6 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white capitalize">{billing.plan} Plan</h2>
              <p className="text-sm text-gray-400 mt-0.5 capitalize">{billing.status}</p>
            </div>
            {billing.has_active_subscription && (
              <button onClick={openPortal} className="text-sm text-accent hover:underline">
                Manage subscription →
              </button>
            )}
          </div>

          {/* Usage bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Workflow Runs</span>
              <span className="text-white">
                {billing.usage.runs_used} / {billing.limits.runs_per_month === -1 ? '∞' : billing.limits.runs_per_month.toLocaleString()}
              </span>
            </div>
            {billing.limits.runs_per_month > 0 && (
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-yellow-500' : 'bg-accent'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            )}
            <div className="flex gap-6 text-xs text-gray-500 mt-2">
              <span>Pack limit: {billing.limits.pack_limit === -1 ? 'Unlimited' : billing.limits.pack_limit}</span>
              <span>Log retention: {billing.limits.retention_days} days</span>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <h2 className="font-semibold text-white mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div key={plan.id}
            className={`p-5 rounded-xl border ${plan.highlighted ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}>
            <h3 className="font-semibold text-white">{plan.name}</h3>
            <p className="text-lg font-bold text-accent mt-1">{plan.price}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-gray-400 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
            {billing?.plan === plan.id ? (
              <div className="mt-4 text-center text-xs text-gray-500">Current plan</div>
            ) : plan.id !== 'free' ? (
              <button
                onClick={() => startCheckout(`price_${plan.id}_placeholder`)}
                disabled={!!checkoutLoading}
                className="mt-4 w-full py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50">
                {checkoutLoading === `price_${plan.id}_placeholder` ? 'Redirecting...' : `Upgrade to ${plan.name}`}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300">
        <strong>Billing is in test mode.</strong> Set <code>BILLING_ENABLED=true</code>, <code>STRIPE_SECRET_KEY</code>,
        and <code>STRIPE_PRICE_*</code> env vars to enable real billing. See{' '}
        <a href="/docs/partners/stripe" className="underline">Stripe setup docs</a>.
      </div>
    </div>
  );
}
