export default function QuickStart() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Quick Start</h1>
        <p className="text-gray-400 mb-8">
          Get up and running with Reach in under 5 minutes. Build and deploy your first agent.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">1. Install the CLI</h2>
            <p className="text-gray-400 mb-4">
              The Reach CLI is the fastest way to create, test, and deploy agents.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>npm install -g @reach/cli</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">2. Create Your First Agent</h2>
            <p className="text-gray-400 mb-4">
              Use the CLI to scaffold a new agent project with all the boilerplate set up.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach create my-first-agent</p>
              <p>cd my-first-agent</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">3. Define Your Agent</h2>
            <p className="text-gray-400 mb-4">
              Edit the agent.yaml file to define your agent&apos;s behavior and capabilities.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`name: my-first-agent`}</p>
              <p>{`version: 1.0.0`}</p>
              <p>{`description: "A simple greeting agent"`}</p>
              <p>{`capabilities:`}</p>
              <p>{`  - greeting`}</p>
              <p>{`  - conversation`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">4. Test Locally</h2>
            <p className="text-gray-400 mb-4">
              Run your agent locally to test its behavior before deploying.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach run</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">5. Deploy</h2>
            <p className="text-gray-400 mb-4">
              Deploy your agent to the Reach network with a single command.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach deploy</p>
            </div>
          </section>

          <section className="card gradient-border">
            <h2 className="text-xl font-bold mb-4">Next Steps</h2>
            <ul className="space-y-2 text-gray-400">
              <li>→ <a href="/docs/installation" className="text-accent hover:underline">Learn about advanced installation options</a></li>
              <li>→ <a href="/docs/configuration" className="text-accent hover:underline">Configure your agent environment</a></li>
              <li>→ <a href="/docs/agents" className="text-accent hover:underline">Explore agent capabilities</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
