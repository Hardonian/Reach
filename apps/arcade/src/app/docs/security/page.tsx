import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Model | ReadyLayer Documentation",
  description:
    "Understand the multi-layered security model of ReadyLayer, from sandboxing to signed execution packs.",
};

export default function SecurityPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Security Model</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer implements a multi-layered security architecture designed
          to contain agent execution and prevent unauthorized data access or
          system mutation.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Layer 1: Signed Execution Packs
        </h2>
        <p className="text-gray-400">
          All agentic workloads in ReadyLayer are bundled into{" "}
          <strong>Execution Packs</strong>. These packs are immutable and
          cryptographically signed.
        </p>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="text-accent mt-1">✓</span>
              <div>
                <span className="font-bold block">Integrity Verification</span>
                <span className="text-sm text-gray-500">
                  Every pack is hashed (SHA-256). Any tampering with the logic
                  or manifest results in an immediate verification failure.
                </span>
              </div>
            </li>
            <li className="items-start gap-3 flex">
              <span className="text-accent mt-1">✓</span>
              <div>
                <span className="font-bold block">Identity Attribution</span>
                <span className="text-sm text-gray-500">
                  Packs are signed by their creators or automation pipelines,
                  allowing operators to restrict execution to trusted sources.
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Layer 2: Capability-Based Security
        </h2>
        <p className="text-gray-400">
          ReadyLayer follows the principle of <strong>Least Privilege</strong>.
          Agents have zero implicit permissions. All access to tools, network,
          or file system must be explicitly declared as a capability.
        </p>
        <div className="bg-black/40 border border-border rounded-xl p-8">
          <h3 className="text-white font-bold mb-4">The Enforcement Flow</h3>
          <ol className="list-decimal list-inside space-y-4 text-gray-400 marker:text-accent font-medium">
            <li>
              Planning: The agent requests a set of capabilities needed for the
              task.
            </li>
            <li>
              Policy Check: The ReadyLayer Policy Engine validates these against
              organizational rules.
            </li>
            <li>
              Pack Generation: A signed pack is created containing only the
              approved capabilities.
            </li>
            <li>
              Execution: The Runner monitors every tool call. If an agent
              attempts an undeclared action, the process is killed.
            </li>
          </ol>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Layer 3: Redaction & Privacy
        </h2>
        <p className="text-gray-400">
          To prevent PII and secret leakage, ReadyLayer implements automatic
          redaction at the service boundary.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card border border-white/5 p-6 rounded-xl">
            <h4 className="font-bold mb-2">Secret Scrubbing</h4>
            <p className="text-xs text-gray-500">
              API keys and session tokens identified in logs or event streams
              are automatically masked before being sent to the UI or stored in
              observability backends.
            </p>
          </div>
          <div className="card border border-white/5 p-6 rounded-xl">
            <h4 className="font-bold mb-2">Data Sovereignty</h4>
            <p className="text-xs text-gray-500">
              ReadyLayer can operate in "Offline-First" mode. In this state, all
              data, audit logs, and vector embeddings remain strictly local to
              the device.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">
          Hardening Checklist
        </h2>
        <p className="text-gray-400">
          For production deployments, ensure the following constraints are
          active:
        </p>
        <pre className="bg-white/5 p-6 rounded-xl border border-white/10 text-xs overflow-x-auto">
          {`# Enforcement Configuration
policy:
  mode: strict
  enforce_signatures: true
  block_undeclared_capabilities: true
  max_retries: 3

isolation:
  max_memory_mb: 512
  max_cpu_percent: 50
  timeout_seconds: 60`}
        </pre>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/governance" className="text-accent hover:underline">
            Governance →
          </a>
        </div>
      </footer>
    </div>
  );
}
