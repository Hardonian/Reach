import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export const metadata = {
  title: "Quickstart — ReadyLayer Docs",
  description: "Run your first readiness check in under 2 minutes. No installation required.",
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
          Your first readiness check in under 2 minutes. Click through the lab or connect your CLI.
        </p>

        <div className="space-y-6">
          {/* Step 1: Run demo */}
          <section className="card gradient-border">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">01</span>
              <h2 className="text-xl font-bold">Run a demo check</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Open the playground and run a pre-built check. It takes less than 30 seconds to see a
              result.
            </p>
            <Link href={ROUTES.PLAYGROUND} className="btn-primary text-sm inline-flex">
              Run demo (free) →
            </Link>
          </section>

          {/* Step 2: See result */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">02</span>
              <h2 className="text-xl font-bold">See the result</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Every run outputs a score and fix suggestions. No manual guesswork required.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm space-y-1">
              <p className="text-yellow-400">⚠ Needs Attention (74/100)</p>
              <p className="text-gray-500">Fix: [HIGH] Tool timeout — set timeout_ms: 1500</p>
            </div>
          </section>

          {/* Step 3: Connect CLI */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">03</span>
              <h2 className="text-xl font-bold">Connect your CLI</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Run checks in your local environment. No permanent installation required.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>npx readylayer-check --demo</p>
            </div>
          </section>

          {/* Step 4: Gate your PRs */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">04</span>
              <h2 className="text-xl font-bold">Gate your PRs</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Block broken agents from merging. Add one YAML file to your GitHub repository.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>- uses: readylayer/gate-action@v1</p>
            </div>
          </section>

          {/* Step 5: Start Monitoring */}
          <section className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-accent">05</span>
              <h2 className="text-xl font-bold">Start Monitoring</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Track your agent health after deployment. Get alerts on drift or tool failures.
            </p>
            <Link
              href={ROUTES.MONITORING}
              className="text-accent hover:underline text-sm font-medium"
            >
              Create your first monitor →
            </Link>
          </section>

          {/* Next steps */}
          <section className="card gradient-border">
            <h2 className="text-xl font-bold mb-4">Next steps</h2>
            <ul className="space-y-2 text-sm">
              <li>
                →{" "}
                <Link href={ROUTES.TEMPLATES} className="text-accent hover:underline">
                  Browse templates
                </Link>{" "}
                — Start from a working baseline
              </li>
              <li>
                →{" "}
                <Link href={ROUTES.LAB} className="text-accent hover:underline">
                  Experiment in Lab
                </Link>{" "}
                — Run side-by-side simulations
              </li>
              <li>
                →{" "}
                <Link href={ROUTES.TRUST.HOME} className="text-accent hover:underline">
                  Trust Center
                </Link>{" "}
                — Compliance and data hygiene
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
