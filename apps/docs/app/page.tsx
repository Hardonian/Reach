import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">Reach</h1>
          <p className="text-xl text-slate-300 mb-8">
            High-performance, deterministic decision engine for autonomous agents and complex
            workflows. Cryptographic provenance and bit-identical replayability for
            production-grade, auditable AI systems.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/docs/quickstart"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition"
            >
              60-Second Quickstart →
            </Link>
            <Link
              href="https://github.com/reach/reach"
              className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-medium transition"
            >
              GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Install */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Install in Seconds</h2>
          <CodeBlock
            code={`# Install from latest GitHub release
curl -fsSL https://github.com/reach/reach/releases/latest/download/install.sh | bash

# Verify install
reach version
reach doctor`}
            language="bash"
          />
        </div>
      </section>

      {/* Example Walkthrough */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">See It In Action</h2>
          <CodeBlock
            code={`$ reach demo
Demo smoke completed.
Run ID: run-...
Capsule: .../capsules/run-....capsule.json
Verified: true
Replay Verified: true`}
            language="bash"
          />
          <div className="text-center mt-6">
            <Link href="/docs/examples" className="text-blue-600 hover:text-blue-800 font-medium">
              Explore all 6 examples →
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Documentation</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/docs/install"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Installation</h3>
              <p className="text-slate-600">
                Install Reach on your local machine or build from source.
              </p>
            </Link>
            <Link
              href="/docs/quickstart"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Quickstart</h3>
              <p className="text-slate-600">
                Get up and running in under a minute with your first decision workflow.
              </p>
            </Link>
            <Link
              href="/docs/cli"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">CLI Reference</h3>
              <p className="text-slate-600">
                Commands for diagnostics, execution, and capsule verification.
              </p>
            </Link>
            <Link
              href="/docs/config"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Configuration</h3>
              <p className="text-slate-600">Environment variables and .reach.json settings.</p>
            </Link>
            <Link
              href="/docs/examples"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Examples</h3>
              <p className="text-slate-600">
                Six complete examples from basic setup to advanced replay verification.
              </p>
            </Link>
            <Link
              href="/docs/presets"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Presets</h3>
              <p className="text-slate-600">
                Choose your starting path with pre-configured policy packs and templates.
              </p>
            </Link>
            <Link
              href="/docs/plugins"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Plugins</h3>
              <p className="text-slate-600">
                Extend Reach with custom analyzers, extractors, and renderers.
              </p>
            </Link>
            <Link
              href="/docs/troubleshooting"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Troubleshooting</h3>
              <p className="text-slate-600">
                Common issues, debug workflows, and how to generate bug reports.
              </p>
            </Link>
            <Link
              href="/docs/stability"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">Stability</h3>
              <p className="text-slate-600">
                What's stable vs experimental, versioning policy, and migration guides.
              </p>
            </Link>
            <Link
              href="/docs/faq"
              className="block p-6 border rounded-lg hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold mb-2">FAQ</h3>
              <p className="text-slate-600">
                Answers to common questions about Reach and determinism.
              </p>
            </Link>
            <section className="col-span-full py-12 px-8 border rounded-xl bg-slate-50">
              <h3 className="text-2xl font-bold mb-8 text-center">OSS vs Enterprise</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-4 font-semibold text-slate-700">Feature</th>
                      <th className="py-4 text-center font-semibold text-slate-700">OSS Core</th>
                      <th className="py-4 text-center font-semibold text-slate-700">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-4 text-slate-600">Deterministic Engine</td>
                      <td className="py-4 text-center">✅</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">Policy Evaluation</td>
                      <td className="py-4 text-center">✅</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">Capsule Verification</td>
                      <td className="py-4 text-center">✅</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">CLI & Local API</td>
                      <td className="py-4 text-center">✅</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">Multi-tenant Auth</td>
                      <td className="py-4 text-center">❌</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">High-fidelity Telemetry</td>
                      <td className="py-4 text-center">❌</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-slate-600">Federated Consensus</td>
                      <td className="py-4 text-center">❌</td>
                      <td className="py-4 text-center">✅</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <Link
              href="/support"
              className="block p-6 border rounded-lg hover:shadow-lg transition bg-blue-50 border-blue-100"
            >
              <h3 className="text-xl font-semibold mb-2">Support</h3>
              <p className="text-slate-600">
                Get help from the community or reach out to Enterprise support.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Contribute */}
      <section className="py-16 px-4 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Contribute to Reach</h2>
          <p className="text-slate-300 mb-8">
            Reach is open source and welcomes contributions. Help us build the future of
            deterministic AI systems.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="https://github.com/reach/reach/blob/main/CONTRIBUTING.md"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition"
            >
              Contributing Guide
            </Link>
            <Link
              href="https://github.com/reach/reach/issues"
              className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-medium transition"
            >
              View Issues
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-950 text-slate-400 text-center">
        <p>Released under MIT License · Version 0.3.1</p>
      </footer>
    </div>
  );
}
