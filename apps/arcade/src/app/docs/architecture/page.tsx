import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Architecture Overview | ReadyLayer Documentation",
  description:
    "Deep dive into the ReadyLayer deterministic execution fabric architecture and boundaries.",
};

export default function ArchitecturePage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Architecture Overview</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer is designed as a deterministic execution fabric, ensuring that agentic
          workloads are replayable, auditable, and secure.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Core Principles</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10 text-pretty">
            <h3 className="font-bold mb-2 text-accent">Determinism</h3>
            <p className="text-sm text-gray-400">
              Every execution in ReadyLayer is captured in a signed execution pack. By stabilizing
              event sequencing and external entropy, ReadyLayer ensures that any run can be replayed
              with bit-perfect accuracy.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10 text-pretty">
            <h3 className="font-bold mb-2 text-accent">Policy Isolation</h3>
            <p className="text-sm text-gray-400">
              Capabilities are not just permissions; they are physical boundaries. ReadyLayer
              enforces policy at the runner level, ensuring that agents cannot bypass gates or
              access unauthorized tools.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">System Boundaries</h2>
        <p className="text-gray-400">
          ReadyLayer maintains strict logical and physical boundaries to prevent configuration drift
          and security leaks.
        </p>
        <ul className="space-y-4">
          <li className="flex gap-4">
            <div className="font-bold text-white shrink-0 w-32">Runner</div>
            <div className="text-gray-400">
              The core execution service (<code>services/runner</code>). Owns runtime execution,
              queueing, and capability firewalls. It is the only component allowed to interact with
              the OS and network.
            </div>
          </li>
          <li className="flex gap-4">
            <div className="font-bold text-white shrink-0 w-32">Policy Engine</div>
            <div className="text-gray-400">
              Evaluates allow/deny decisions based on signed policy profiles. It operates as a
              stateless oracle for the Runner.
            </div>
          </li>
          <li className="flex gap-4">
            <div className="font-bold text-white shrink-0 w-32">Packkit</div>
            <div className="text-gray-400">
              Handles the lifecycle of execution packs, including indexing, hashing, and signature
              verification.
            </div>
          </li>
          <li className="flex gap-4">
            <div className="font-bold text-white shrink-0 w-32">Marketplace</div>
            <div className="text-gray-400">
              A pure discovery layer. It can suggest packs and connectors but has no authority to
              install or execute code without explicit user consent.
            </div>
          </li>
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Trust Invariants</h2>
        <div className="bg-black/40 border border-accent/20 rounded-xl p-8">
          <p className="mb-4">
            The ReadyLayer protocol enforces several non-negotiable trust rules to ensure system
            integrity:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400 marker:text-accent">
            <li>Signature and SHA verification are mandatory for all external modules.</li>
            <li>Install operations require a cryptographically signed intent key.</li>
            <li>Pinned versions are immutable; silent auto-upgrades are prohibited.</li>
            <li>All registry fetches are rate-limited and size-bounded.</li>
            <li>Secret redaction happens at the Runner boundary; no raw secrets reach the UI.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Data Flow Diagram</h2>
        <div className="bg-white/5 p-8 rounded-xl border border-white/10 font-mono text-sm overflow-x-auto whitespace-pre">
          {`+-------------------+        +-------------------+
| Clients / IDEs    |  API   | services/runner   |
| Arcade / VS Code  +------->+ orchestration     |
+-------------------+        +---------+---------+
                                        |
                                        | execution packs + policy
                                        v
                              +---------+---------+
                              | crates/engine*    |
                              | deterministic core|
                              +---------+---------+
                                        |
                                        | tool calls / integrations
                                        v
                              +-------------------+
                              | MCP + connectors  |
                              +-------------------+`}
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/governance" className="text-accent hover:underline">
            Governance Model →
          </a>
        </div>
      </footer>
    </div>
  );
}
