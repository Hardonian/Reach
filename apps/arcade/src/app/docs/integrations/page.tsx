import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integrations | ReadyLayer Documentation',
  description: 'Connect ReadyLayer to your existing tools, SDKs, and platforms.',
};

export default function IntegrationsPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Integrations</h1>
        <p className="text-xl text-gray-400">
          ReadyLayer is built to be the execution layer for your entire stack.
          Connect to IDEs, cloud providers, and custom services via our standardized protocol.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">IDE Extensions</h2>
        <div className="card bg-white/5 p-8 rounded-xl border border-white/10">
          <h3 className="text-xl font-bold text-white mb-2">VS Code</h3>
          <p className="text-sm text-gray-400 mb-6">
            The ReadyLayer VS Code extension provides integrated agent execution, real-time event logs,
            and pack management directly within your editor.
          </p>
          <ul className="grid md:grid-cols-2 gap-4 text-xs text-gray-500 mb-6">
            <li className="flex items-center gap-2"><span className="text-accent">→</span> One-click agent submission</li>
            <li className="flex items-center gap-2"><span className="text-accent">→</span> Integrated ReadyLayer Doctor diagnostics</li>
            <li className="flex items-center gap-2"><span className="text-accent">→</span> In-editor deterministic replay</li>
            <li className="flex items-center gap-2"><span className="text-accent">→</span> Policy violation highlighting</li>
          </ul>
          <div className="bg-black/40 p-3 rounded font-mono text-xs select-all text-white">
            ext install Hardonian.reach-vscode
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">SDKs</h2>
        <p className="text-gray-400">Build custom integrations using our typed SDKs.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-white/5 p-6 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
            <h4 className="font-bold text-white">TypeScript SDK</h4>
            <p className="text-xs text-gray-500 mt-1">Full gRPC and REST support for Node.js and Browser environments.</p>
            <code className="block mt-4 text-[10px] text-accent">npm install @reach-dev/sdk</code>
          </div>
          <div className="border border-white/5 p-6 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
            <h4 className="font-bold text-white">Go SDK</h4>
            <p className="text-xs text-gray-500 mt-1">High-performance internal service communication with built-in capability guards.</p>
            <code className="block mt-4 text-[10px] text-accent">go get github.com/reach-dev/sdk-go</code>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Webhooks & Events</h2>
        <p className="text-gray-400 text-sm">
          Connect ReadyLayer to external event sources to trigger agentic executions automatically.
        </p>
        <div className="bg-black/20 rounded-xl p-8 border border-white/5">
          <p className="text-sm text-gray-500 mb-4">Supported Event Hubs:</p>
          <div className="flex flex-wrap gap-4">
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] border border-white/10">GitHub Webhooks</span>
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] border border-white/10">Slack Events</span>
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] border border-white/10">AWS EventBridge</span>
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] border border-white/10">Custom Webhooks</span>
          </div>
        </div>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/webhooks" className="text-accent hover:underline">Webhook Documentation →</a>
        </div>
      </footer>
    </div>
  );
}
