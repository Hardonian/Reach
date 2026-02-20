import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference | Reach Documentation',
  description: 'Comprehensive API reference for the Reach orchestration platform services.',
};

export default function APIPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">API Reference</h1>
        <p className="text-xl text-gray-400">
          The Reach platform exposes a series of gRPC and REST APIs via its core services
          to enable orchestration, registry management, and session control.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Core Services</h2>
        <div className="space-y-4">
          <div className="group border-l-4 border-accent bg-white/5 p-6 rounded-r-xl">
            <h3 className="font-bold text-white mb-1">Runner Service</h3>
            <p className="text-sm text-gray-400 mb-2">Endpoint: <code>:8080/v1/runner</code></p>
            <p className="text-sm text-gray-500">
              The primary execution interface. Handles pack submission, status polling, and event streaming.
            </p>
          </div>
          <div className="group border-l-4 border-blue-500 bg-white/5 p-6 rounded-r-xl">
            <h3 className="font-bold text-white mb-1">Registry Service</h3>
            <p className="text-sm text-gray-400 mb-2">Endpoint: <code>:8080/v1/registry</code></p>
            <p className="text-sm text-gray-500">
              Manages the collection of capabilities and connectors. Supports searching and versioning.
            </p>
          </div>
          <div className="group border-l-4 border-green-500 bg-white/5 p-6 rounded-r-xl">
            <h3 className="font-bold text-white mb-1">Policy Service</h3>
            <p className="text-sm text-gray-400 mb-2">Endpoint: <code>:8080/v1/policy</code></p>
            <p className="text-sm text-gray-500">
              Evaluates execution requests against organizational policy profiles.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Authentication</h2>
        <p className="text-gray-400 text-sm">
          All requests to the Reach API require a <strong>Reach-Token</strong> or Bearer authentication header.
        </p>
        <div className="bg-black/40 p-4 rounded-lg font-mono text-xs">
          <span className="text-accent">GET</span> /v1/runner/status <br/>
          Authorization: Bearer reach_sk_test_123456789
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Common Workflows</h2>

        <div className="space-y-8">
          <div>
            <h3 className="font-bold text-white mb-4">1. Submitting a Run</h3>
            <p className="text-sm text-gray-400 mb-4">
              Submit an execution intent to the runner. Returns a <code>run_id</code> and a preview of the execution pack.
            </p>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-xs font-mono overflow-x-auto text-gray-300">
{`POST /v1/runner/execute
{
  "intent": "analyze_repo",
  "capabilities": ["io.fs.read", "llm.generate"],
  "inputs": {
    "repo_path": "/home/user/reach"
  }
}

// Response 202 Accepted
{
  "run_id": "82b9-c12e-9d0a",
  "status": "QUEUED",
  "pack_hash": "sha256:..."
}`}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white mb-4">2. Streaming Events</h3>
            <p className="text-sm text-gray-400 mb-4">
              Attach to a running execution to receive live status updates and tool outputs.
            </p>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-xs font-mono overflow-x-auto text-gray-300">
{`GET /v1/runner/stream/{run_id}
event: step_start
data: {"step": "read_readme", "capability": "io.fs.read"}

event: tool_output
data: {"content": "Reach: A deterministic execution fabric..."}

event: run_complete
data: {"result": "success"}`}
            </div>
          </div>
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/webhooks" className="text-accent hover:underline">Webhook Integration →</a>
        </div>
      </footer>
    </div>
  );
}
