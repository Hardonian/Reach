import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CLI Reference | ReadyLayer Documentation",
  description: "Authority reference for the ReadyLayer command line tool and diagnostic utility.",
};

export default function CLIPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">CLI Reference</h1>
        <p className="text-xl text-gray-400">
          The <code>reach</code> CLI is the unified entry point for managing execution, diagnosing
          system health, and interacting with the ReadyLayer protocol.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Diagnostic Commands</h2>

        <div className="card bg-white/5 border border-white/10 p-8 rounded-xl">
          <h3 className="text-xl font-bold mb-4 text-accent">reach doctor</h3>
          <p className="text-gray-400 mb-6">
            The single authoritative health command for trust and hardening checks. It validates the
            entire execution chain from registry to engine.
          </p>
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-white">Validation Checks:</h4>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-500 list-disc list-inside">
              <li>Registry source wiring</li>
              <li>Index schema parsing</li>
              <li>Signature verification path</li>
              <li>Policy routing configuration</li>
              <li>Runner firewall markers</li>
              <li>Marketplace consent gates</li>
              <li>Architecture boundaries</li>
              <li>Memory/CPU overhead</li>
            </ul>
          </div>
          <div className="mt-8 bg-black/40 p-4 rounded-lg font-mono text-xs text-white">
            $ ./reach doctor <br />
            [OK] Registry integrity validated <br />
            [OK] Signature path presence verified <br />
            [OK] Policy gate configuration healthy <br />
            [OK] System boundaries enforced
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Execution Commands</h2>
        <div className="space-y-6">
          <div className="group">
            <h3 className="font-bold text-white mb-2">reach wizard</h3>
            <p className="text-sm text-gray-400 mb-4">
              A guided, terminal-based UI for mobile and desktop. Walk through pack selection, risk
              acknowledgment, and execution with built-in safety checks.
            </p>
            <code className="bg-white/5 px-2 py-1 rounded text-accent text-xs">reach wizard</code>
          </div>

          <div className="group">
            <h3 className="font-bold text-white mb-2">reach run &lt;pack-id&gt;</h3>
            <p className="text-sm text-gray-400 mb-4">
              Directly execute a signed pack. Requires the pack to exist in the local registry and
              all capability permissions to be pre-authorized.
            </p>
            <code className="bg-white/5 px-2 py-1 rounded text-accent text-xs">
              reach run sentinel-v1
            </code>
          </div>

          <div className="group">
            <h3 className="font-bold text-white mb-2">reach operator</h3>
            <p className="text-sm text-gray-400 mb-4">
              Dashboard mode. Displays a live view of the runner status, active executions, and
              system resource consumption.
            </p>
            <code className="bg-white/5 px-2 py-1 rounded text-accent text-xs">reach operator</code>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Sharing & Collaboration</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 border border-white/5 rounded-xl">
            <h3 className="font-bold mb-2">reach share run &lt;id&gt;</h3>
            <p className="text-sm text-gray-400">
              Generates a tamper-evident execution capsule. On mobile, this produces a QR code for
              device-to-device verification.
            </p>
          </div>
          <div className="card p-6 border border-white/5 rounded-xl">
            <h3 className="font-bold mb-2">reach proof verify &lt;id&gt;</h3>
            <p className="text-sm text-gray-400">
              Performs a bit-perfect determinism check against the execution event log to verify
              that a run has not been tampered with.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/api" className="text-accent hover:underline">
            API Reference →
          </a>
        </div>
      </footer>
    </div>
  );
}
