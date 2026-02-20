import Link from 'next/link';

export const metadata = { title: 'Deploy to Vercel — Reach Partners' };

export default function VercelPartnerPage() {
  return (
    <div className="section-container py-20 max-w-4xl prose prose-invert">
      <div className="mb-8">
        <Link href="/docs" className="text-accent hover:underline text-sm">← Docs</Link>
      </div>
      <h1>Deploy Reach Cloud to Vercel</h1>
      <p className="lead">
        Deploy the Reach console and API to Vercel in minutes. Edge-compatible routes use the Node.js runtime where required (SQLite, Stripe webhooks).
      </p>

      <h2>Value Proposition</h2>
      <ul>
        <li>Zero-config deployments with preview branches</li>
        <li>Automatic HTTPS and CDN for the console UI</li>
        <li>Serverless API routes scale to zero</li>
        <li>Environment variable management via Vercel dashboard</li>
        <li>Preview deployments per pull request for staging</li>
      </ul>

      <h2>Prerequisites</h2>
      <ul>
        <li>Vercel account (free tier works for dev)</li>
        <li>A Turso / LibSQL or PlanetScale database for cloud DB (or SQLite via tmp for testing)</li>
        <li>Stripe account (for billing)</li>
        <li>Redis instance (optional, for rate limiting) — Upstash recommended</li>
      </ul>

      <h2>Quick Deploy</h2>
      <pre><code>{`# Install Vercel CLI
npm i -g vercel

# From repo root
cd apps/arcade
vercel

# Follow prompts to link/create project
# Then set env vars:`}</code></pre>

      <h2>Required Environment Variables</h2>
      <pre><code>{`# Cloud features
REACH_CLOUD_ENABLED=true
CLOUD_DB_PATH=/tmp/reach-cloud.db   # or use DATABASE_URL for Turso

# Session
REACH_SESSION_COOKIE_NAME=reach_session
REACH_SESSION_TTL_HOURS=24

# Stripe (optional but recommended)
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...

# Marketplace
MARKETPLACE_ENABLED=true

# HuggingFace (optional)
HF_API_TOKEN=hf_...

# Redis (optional, for rate limiting)
REDIS_URL=redis://...

# Runner service (if self-hosted)
REACH_RUNNER_URL=https://your-runner.example.com`}</code></pre>

      <h2>vercel.json Configuration</h2>
      <pre><code>{`{
  "buildCommand": "npm run build -w arcade",
  "outputDirectory": "apps/arcade/.next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "functions": {
    "apps/arcade/src/app/api/v1/billing/webhook/route.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    }
  },
  "regions": ["iad1"],
  "env": {
    "REACH_CLOUD_ENABLED": "true"
  }
}`}</code></pre>

      <h2>Important: Node.js Runtime for Webhooks</h2>
      <p>
        The Stripe webhook handler MUST run on the Node.js runtime (not Edge) to access raw request body bytes for signature verification.
        All <code>/api/v1/billing/*</code> routes already have <code>export const runtime = 'nodejs'</code>.
      </p>

      <h2>SQLite on Vercel</h2>
      <p>
        Vercel functions are stateless — SQLite files written to <code>/tmp</code> are ephemeral and lost between requests.
        For production, use <strong>Turso</strong> (LibSQL):
      </p>
      <pre><code>{`npm install @libsql/client
# Then update CLOUD_DB_PATH to use:
CLOUD_DB_PATH=libsql://your-db.turso.io?authToken=your-token`}</code></pre>
      <p>For development and preview deployments, <code>/tmp</code> SQLite works fine.</p>

      <h2>Preview Deploy Compatibility</h2>
      <ul>
        <li>Each PR gets a unique preview URL automatically</li>
        <li>Set Stripe webhook to your preview URL for testing (use Stripe CLI for local)</li>
        <li>Preview deploys share the same env vars unless overridden per environment in Vercel dashboard</li>
      </ul>

      <h2>Troubleshooting</h2>
      <ul>
        <li><strong>Build fails on better-sqlite3:</strong> Set <code>CLOUD_DB_PATH</code> to use LibSQL for Vercel (native binaries not supported)</li>
        <li><strong>Webhook signature fails:</strong> Ensure <code>STRIPE_WEBHOOK_SECRET</code> matches the endpoint in Stripe dashboard</li>
        <li><strong>Session not persisting:</strong> SQLite <code>/tmp</code> is per-instance. Use Turso for persistent sessions</li>
        <li><strong>502 timeout:</strong> Runner service calls may time out. Increase function <code>maxDuration</code> in vercel.json</li>
      </ul>
    </div>
  );
}
