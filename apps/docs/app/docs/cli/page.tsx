import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function CLIPage() {
  return (
    <DocLayout currentPath="/docs/cli" title="CLI Reference">
      <p className="text-lg text-slate-600 mb-8">
        The <code>reach</code> CLI is the unified entry point for managing execution, diagnosing
        system health, and interacting with the Reach protocol.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Diagnostic Commands</h2>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-xl font-bold mb-4 text-slate-900">reach doctor</h3>
          <p className="text-slate-600 mb-4">
            The single authoritative health command for trust and hardening checks. It validates the
            entire execution chain from registry to engine.
          </p>
          <div className="mb-6">
            <h4 className="font-bold text-sm text-slate-700 mb-2">Validation Checks:</h4>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-500 list-disc list-inside">
              <li>Registry source wiring</li>
              <li>Index schema parsing</li>
              <li>Signature verification path</li>
              <li>Policy routing configuration</li>
              <li>Runner firewall markers</li>
              <li>Architecture boundaries</li>
              <li>Memory/CPU overhead</li>
            </ul>
          </div>
          <CodeBlock
            code={`$ reach doctor
[OK] Registry integrity validated
[OK] Signature path presence verified
[OK] Policy gate configuration healthy
[OK] System boundaries enforced`}
            language="text"
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Execution Commands</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">reach run &lt;pack-id&gt;</h3>
            <p className="text-slate-600 mb-4">
              Directly execute a signed pack. Requires the pack to exist in the local registry and
              all capability permissions to be pre-authorized.
            </p>
            <CodeBlock code={`reach run sentinel-v1`} language="bash" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">reach demo</h3>
            <p className="text-slate-600 mb-4">
              Runs a pre-bundled smoke test to verify local installation and engine readiness.
            </p>
            <CodeBlock code={`reach demo`} language="bash" />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Capsule & Determinism</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-bold mb-2">reach capsule verify &lt;file&gt;</h3>
            <p className="text-sm text-slate-600">
              Generates a tamper-evident execution capsule. For audit logs and external
              verification.
            </p>
          </div>
          <div className="p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-bold mb-2">reach capsule replay &lt;file&gt;</h3>
            <p className="text-sm text-slate-600">
              Performs a bit-perfect determinism check against the execution event log to verify
              replayability.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
        <span>Last updated: Feb 2026</span>
        <a href="https://github.com/reach/reach" className="text-blue-600 hover:underline">
          Source code on GitHub →
        </a>
      </footer>
    </DocLayout>
  );
}
