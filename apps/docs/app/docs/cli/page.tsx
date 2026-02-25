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
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xl font-bold mb-4 text-slate-900">reach doctor</h3>
            <p className="text-slate-600 mb-4">
              Diagnoses the local environment for critical dependencies and data directory health.
            </p>
            <CodeBlock
              code={`$ reach doctor
Reach Doctor - Diagnosing local environment...
[ ] Go Version           OK
[ ] Node.js Version      OK
[ ] SQLite Version       OK
[ ] Data Directory       OK`}
              language="text"
            />
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xl font-bold mb-4 text-slate-900">reach status</h3>
            <p className="text-slate-600 mb-4">
              Reports active operating mode, configuration sources, and database connectivity.
            </p>
            <CodeBlock
              code={`$ reach status
Reach Status
============
Mode: oss
Database: ok (data/reach.db)
Config: reach.yaml`}
              language="text"
            />
          </div>
        </div>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-xl font-bold mb-2 text-slate-900">reach bugreport</h3>
          <p className="text-slate-600 mb-4">
            Generates a sanitized ZIP bundle containing logs and system metadata for
            troubleshooting.
          </p>
          <CodeBlock code={`reach bugreport --output diagnostic-bundle.zip`} language="bash" />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Execution & Versioning</h2>
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-2">reach demo</h3>
              <p className="text-slate-600 mb-4">
                Executes a deterministic smoke test to verify engine readiness.
              </p>
              <CodeBlock code={`reach demo smoke`} language="bash" />
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-2">reach version</h3>
              <p className="text-slate-600 mb-4">
                Prints bit-identical version information for the execution fabric.
              </p>
              <CodeBlock code={`reach version`} language="bash" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">reach run &lt;pack-id&gt;</h3>
            <p className="text-slate-600 mb-4">
              Directly execute a signed pack from the local registry.
            </p>
            <CodeBlock code={`reach run sentinel-v1`} language="bash" />
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
