import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export const metadata = {
  title: 'Quickstart — ReadyLayer Docs',
  description: 'Run your first readiness check in under 2 minutes. No installation required.',
};

export default function QuickStart() {
  return (
    <div className="section-container py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-3">Quickstart</h1>
        <p className="text-gray-400 mb-2">
          Your first readiness check in under 2 minutes.
        </p>
        <p className="text-emerald-400 text-sm font-medium mb-10">
          No installation required for the demo path.
        </p>

        <div className="space-y-6">

          {/* Step 0: Try instantly */}
          <section className="card gradient-border">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">00</span>
              <h2 className="text-xl font-bold">Try it in the browser (no account)</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              The fastest path: open the playground, click one button, see a result.
            </p>
            <Link href={ROUTES.PLAYGROUND} className="btn-primary text-sm inline-flex">
              Open Playground →
            </Link>
          </section>

          {/* Step 1: Install */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">01</span>
              <h2 className="text-xl font-bold">Install the CLI</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              One command. Requires Node 18+.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-2">
              <p>npm install -g @readylayer/cli</p>
            </div>
            <p className="text-xs text-gray-500">Or use Docker: see <Link href="/docs/installation" className="text-accent hover:underline">installation guide</Link>.</p>
          </section>

          {/* Step 2: Run a check */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">02</span>
              <h2 className="text-xl font-bold">Run your first check</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Point ReadyLayer at your agent config. The <code className="text-accent">--demo</code> flag uses built-in fixtures.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-gray-500"># With demo data (no agent required)</span></p>
              <p>reachctl check --demo</p>
              <p>&nbsp;</p>
              <p><span className="text-gray-500"># With your own agent config</span></p>
              <p>reachctl check --config agent.yaml</p>
            </div>
          </section>

          {/* Step 3: Read the result */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">03</span>
              <h2 className="text-xl font-bold">Read the result</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Every run outputs a score, a status badge, and fix suggestions. No manual interpretation.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm space-y-1">
              <p className="text-yellow-400">⚠ Needs Attention (score: 74/100)</p>
              <p className="text-gray-400">&nbsp;</p>
              <p className="text-gray-300">Findings:</p>
              <p className="text-red-400">  [HIGH]  Tool timeout exceeded — set timeout_ms: 1500</p>
              <p className="text-yellow-400">  [MED]   Unguarded external call — add allow-list</p>
              <p className="text-blue-400">  [LOW]   Output schema drift — update baseline</p>
            </div>
          </section>

          {/* Step 4: Fix + rerun */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">04</span>
              <h2 className="text-xl font-bold">Fix and rerun</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Apply the suggested fixes, rerun the check, and track the score improvement.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-gray-500"># After applying fixes:</span></p>
              <p>reachctl check --config agent.yaml --compare-to last</p>
              <p>&nbsp;</p>
              <p className="text-emerald-400">✅ Pass (score: 91/100) — 0 high findings</p>
            </div>
          </section>

          {/* Step 5: Gate CI/CD */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">05</span>
              <h2 className="text-xl font-bold">Gate your CI/CD</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Add ReadyLayer to GitHub Actions. Blocks merges that regress your agent score.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-gray-500"># .github/workflows/agent-check.yml</span></p>
              <p>- uses: readylayer/check-action@v1</p>
              <p>  with:</p>
              <p>    config: agent.yaml</p>
              <p>    min_score: 80</p>
              <p>    fail_on: high</p>
            </div>
          </section>

          {/* Next steps */}
          <section className="card gradient-border">
            <h2 className="text-xl font-bold mb-4">Next steps</h2>
            <ul className="space-y-2 text-sm">
              <li>→ <Link href={ROUTES.TEMPLATES} className="text-accent hover:underline">Browse templates</Link> — start from a working baseline</li>
              <li>→ <Link href="/docs/configuration" className="text-accent hover:underline">Configure your checks</Link> — customize rules and thresholds</li>
              <li>→ <Link href="/docs/cli" className="text-accent hover:underline">CLI reference</Link> — full command list</li>
              <li>→ <Link href="/docs/agents" className="text-accent hover:underline">Agent integration guide</Link> — connect your stack</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
