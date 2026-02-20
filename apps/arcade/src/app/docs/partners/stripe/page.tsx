import Link from 'next/link';

export const metadata = { title: 'Stripe Billing Setup — Reach Partners' };

export default function StripePartnerPage() {
  return (
    <div className="section-container py-20 max-w-4xl prose prose-invert">
      <div className="mb-8">
        <Link href="/docs" className="text-accent hover:underline text-sm">← Docs</Link>
      </div>
      <h1>Stripe Billing Integration</h1>
      <p className="lead">
        Reach Cloud uses Stripe for subscription billing. This guide covers setup, webhook configuration, local testing, and security notes.
      </p>

      <h2>Architecture Overview</h2>
      <ul>
        <li><strong>Checkout:</strong> <code>POST /api/v1/billing/checkout</code> creates a Stripe Checkout Session</li>
        <li><strong>Portal:</strong> <code>POST /api/v1/billing/portal</code> creates a Stripe Customer Portal session</li>
        <li><strong>Webhooks:</strong> <code>POST /api/v1/billing/webhook</code> handles Stripe events with raw body verification</li>
        <li><strong>Entitlements:</strong> Updated automatically when subscriptions change</li>
        <li><strong>Idempotency:</strong> All webhook events are deduplicated by <code>stripe_event_id</code></li>
      </ul>

      <h2>Setup (15 minutes)</h2>

      <h3>Step 1: Create Stripe account and products</h3>
      <ol>
        <li>Go to <a href="https://stripe.com" target="_blank" rel="noopener">stripe.com</a> and create an account</li>
        <li>Create Products in the Stripe dashboard for each plan (Pro, Team, Enterprise)</li>
        <li>Copy the Price IDs (format: <code>price_...</code>) for each plan</li>
      </ol>

      <h3>Step 2: Configure environment variables</h3>
      <pre><code>{`# Enable billing
BILLING_ENABLED=true

# Stripe keys (from dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...          # Use sk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_...        # Set after step 3

# Price IDs (from dashboard → Products)
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_TEAM=price_yyyyyyyyyyyyy
STRIPE_PRICE_ENTERPRISE=price_zzzzzzz`}</code></pre>

      <h3>Step 3: Configure webhook endpoint</h3>
      <p>In Stripe dashboard → Developers → Webhooks → Add endpoint:</p>
      <ul>
        <li>URL: <code>https://yourdomain.com/api/v1/billing/webhook</code></li>
        <li>Events to listen for:</li>
      </ul>
      <pre><code>{`customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed`}</code></pre>
      <p>Copy the <strong>Signing secret</strong> (starts with <code>whsec_</code>) and set <code>STRIPE_WEBHOOK_SECRET</code>.</p>

      <h2>Local Testing with Stripe CLI</h2>
      <pre><code>{`# Install Stripe CLI
brew install stripe/stripe-cli/stripe   # macOS
# or: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/v1/billing/webhook

# The CLI prints a webhook signing secret — use it for local dev:
# export STRIPE_WEBHOOK_SECRET=whsec_test_...

# In another terminal, trigger test events:
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted`}</code></pre>

      <h2>Webhook Events Handled</h2>
      <table>
        <thead><tr><th>Event</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td><code>customer.subscription.created</code></td><td>Upgrade tenant plan, set limits</td></tr>
          <tr><td><code>customer.subscription.updated</code></td><td>Update plan/status/limits</td></tr>
          <tr><td><code>customer.subscription.deleted</code></td><td>Downgrade to free plan</td></tr>
          <tr><td><code>invoice.paid</code></td><td>Reset monthly usage counter</td></tr>
          <tr><td><code>invoice.payment_failed</code></td><td>Set status to past_due</td></tr>
        </tbody>
      </table>

      <h2>Idempotency &amp; Reliability</h2>
      <p>The webhook handler is designed to be called multiple times safely:</p>
      <ul>
        <li>Every <code>stripe_event_id</code> is stored in the <code>webhook_events</code> table on first receipt</li>
        <li>Duplicate events return <code>{"{'ok': true, 'duplicate': true}"}</code> without re-processing</li>
        <li>The handler always returns HTTP 200 to prevent Stripe from retrying (events are stored for manual review)</li>
        <li>Stripe's automatic retries (up to 72 hours) are handled gracefully</li>
      </ul>

      <h2>Security Notes</h2>
      <ul>
        <li><strong>Raw body verification:</strong> The webhook reads <code>req.arrayBuffer()</code> before any parsing — required for HMAC-SHA256 signature verification</li>
        <li><strong>Never disable signature verification</strong> in production — without it, anyone can forge billing events</li>
        <li><strong>Secret key scope:</strong> Use <code>sk_test_</code> in development, <code>sk_live_</code> in production only</li>
        <li><strong>Logs:</strong> Reach sanitizes logs to prevent <code>STRIPE_SECRET_KEY</code> from appearing in output</li>
        <li><strong>Restricted API keys:</strong> Consider using Stripe's restricted API keys if you only need specific permissions</li>
      </ul>

      <h2>Plan Entitlement Reference</h2>
      <table>
        <thead><tr><th>Plan</th><th>Runs/Month</th><th>Pack Limit</th><th>Retention</th></tr></thead>
        <tbody>
          <tr><td>Free</td><td>100</td><td>5</td><td>7 days</td></tr>
          <tr><td>Pro</td><td>10,000</td><td>100</td><td>90 days</td></tr>
          <tr><td>Team</td><td>50,000</td><td>500</td><td>180 days</td></tr>
          <tr><td>Enterprise</td><td>Unlimited</td><td>Unlimited</td><td>365 days</td></tr>
        </tbody>
      </table>
    </div>
  );
}
