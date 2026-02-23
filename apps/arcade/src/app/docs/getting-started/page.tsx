import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Started | ReadyLayer Documentation",
  description:
    "Go from zero to a fully deterministic execution in 5 minutes with our Quick Start guide.",
};

export default function GettingStartedPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Getting Started</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer is a deterministic execution fabric. In this guide, we will
          set up the ReadyLayer environment, execute your first signed pack, and
          verify its results.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          1. Installation
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-white">Desktop / Server</h3>
            <p className="text-sm text-gray-400">
              Build from source with Node, Go, and Rust runtimes.
            </p>
            <div className="bg-black/40 p-4 rounded-lg font-mono text-xs space-y-1">
              <div className="text-gray-500"># Clone and install</div>
              <div className="text-white">
                git clone https://github.com/XHARDONIANXSLASHXReadyLayer.git
              </div>
              <div className="text-white">npm install</div>
              <div className="text-white">npm run build</div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-bold text-white">Mobile (Android)</h3>
            <p className="text-sm text-gray-400">
              Use our one-line installer for Termux environments.
            </p>
            <div className="bg-black/40 p-4 rounded-lg font-mono text-xs space-y-1">
              <div className="text-gray-500"># One-tap install</div>
              <div className="text-accent">
                curl -fsSL https://get.reach.dev/termux | bash
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          2. System Health Check
        </h2>
        <p className="text-gray-400">
          Before running agentic workloads, verify your environment with{" "}
          <code>doctor</code>.
        </p>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <div className="bg-black/20 p-4 rounded font-mono text-xs text-green-500">
            $ ./reach doctor <br />
            [OK] Deterministic Core Ready <br />
            [OK] Capability Registry Wired <br />
            [OK] Policy Firewall Enabled
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          3. Running the Wizard
        </h2>
        <p className="text-gray-400">
          The <code>reach wizard</code> is the fastest way to explore the
          ReadyLayer marketplace and execute your first task.
        </p>
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold shrink-0">
              1
            </span>
            <div>
              <span className="font-bold text-white">Select a Pack</span>
              <p className="text-sm text-gray-500">
                Choose from available execution templates like "Repo Audit" or
                "Skill Discovery".
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold shrink-0">
              2
            </span>
            <div>
              <span className="font-bold text-white">Review Capabilities</span>
              <p className="text-sm text-gray-500">
                Explicitly consent to the tool permissions required by the pack.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold shrink-0">
              3
            </span>
            <div>
              <span className="font-bold text-white">Execute and Stream</span>
              <p className="text-sm text-gray-500">
                Watch the execution event log stream in real-time with full
                determinism.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Next Steps
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/docs/architecture"
            className="card bg-white/5 p-6 rounded-xl border border-white/10 hover:border-accent/50 transition-colors"
          >
            <h3 className="font-bold mb-1">Architecture Deep Dive</h3>
            <p className="text-xs text-gray-500">
              Learn about signed packs and capability firewalls.
            </p>
          </a>
          <a
            href="/docs/api"
            className="card bg-white/5 p-6 rounded-xl border border-white/10 hover:border-accent/50 transition-colors"
          >
            <h3 className="font-bold mb-1">API Reference</h3>
            <p className="text-xs text-gray-500">
              Integrate ReadyLayer into your own applications via gRPC/REST.
            </p>
          </a>
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/mcp" className="text-accent hover:underline">
            MCP Integration →
          </a>
        </div>
      </footer>
    </div>
  );
}
