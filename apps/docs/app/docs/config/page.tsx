import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function ConfigPage() {
  return (
    <DocLayout currentPath="/docs/config" title="Configuration">
      <p className="text-lg text-slate-600 mb-8">
        Reach is designed to be "zero-config" for basic usage, but offers fine-grained control via environment variables and configuration files for production hardening.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">The .reach.json File</h2>
        <p className="mb-4">
          The main configuration file is <code>.reach.json</code>, placed at the root of your project.
        </p>
        <CodeBlock
          code={`{
  "project": "my-agent-system",
  "version": "1.0.0",
  "engines": {
    "decision": "classical-v1",
    "verification": "strict"
  },
  "storage": {
    "type": "sqlite",
    "path": "./data/reach.db"
  }
}`}
          language="json"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Environment Variables</h2>
        <p className="mb-4">
          Environment variables take precedence over configuration files. Use them for secrets and CI-specific overrides.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2 text-left text-sm font-bold text-slate-700">Variable</th>
                <th className="px-4 py-2 text-left text-sm font-bold text-slate-700">Description</th>
                <th className="px-4 py-2 text-left text-sm font-bold text-slate-700">Default</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600">
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2"><code>REACH_LOG_LEVEL</code></td>
                <td className="px-4 py-2">Logging verbosity (debug, info, warn, error)</td>
                <td className="px-4 py-2"><code>info</code></td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2"><code>REACH_DETERMINISM_STRICT</code></td>
                <td className="px-4 py-2">Fail hard on any detectably non-deterministic event</td>
                <td className="px-4 py-2"><code>true</code></td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2"><code>REACH_DATA_DIR</code></td>
                <td className="px-4 py-2">Directory for local storage and capsules</td>
                <td className="px-4 py-2"><code>./data</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Validation</h2>
        <p>
          Run <code>reach doctor</code> after changing your configuration to ensure all paths are writable and settings are valid.
        </p>
      </section>
    </DocLayout>
  );
}
