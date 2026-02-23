export default function Marketplace() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Marketplace</h1>
        <p className="text-gray-400 mb-8">
          Discover, share, and deploy pre-built agents and integrations from the community.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What is the Marketplace?</h2>
            <p className="text-gray-400">
              The ReadyLayer Marketplace is a community-driven repository of agents, connectors, and
              templates. Find solutions for common use cases or share your own creations with the
              world.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Marketplace Categories</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Agents</h3>
                <p className="text-gray-400 text-sm">
                  Ready-to-deploy agents for specific tasks like data processing, customer support,
                  or content generation.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Connectors</h3>
                <p className="text-gray-400 text-sm">
                  Integrations with popular services like Slack, Discord, GitHub, and more.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Templates</h3>
                <p className="text-gray-400 text-sm">
                  Starter templates for common agent patterns and architectures.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Tools</h3>
                <p className="text-gray-400 text-sm">
                  Reusable tools and utilities that agents can use.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Installing from Marketplace</h2>
            <p className="text-gray-400 mb-4">Install agents and connectors using the CLI:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>{`# Search the marketplace`}</p>
              <p>reach marketplace search slack</p>
              <p>{``}</p>
              <p>{`# Install an agent`}</p>
              <p>reach marketplace install @reach/slack-connector</p>
              <p>{``}</p>
              <p>{`# Install a specific version`}</p>
              <p>reach marketplace install @reach/slack-connector@1.2.0</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Publishing to Marketplace</h2>
            <p className="text-gray-400 mb-4">Share your creations with the community:</p>
            <div className="space-y-3 text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">1.</span>
                <div>Prepare your agent with proper documentation</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">2.</span>
                <div>Create a README with usage examples</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">3.</span>
                <div>Add required metadata to agent.yaml</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">4.</span>
                <div>Submit for review</div>
              </div>
            </div>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mt-4">
              <p>reach marketplace publish</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Package Format</h2>
            <p className="text-gray-400 mb-4">Marketplace packages follow the Pack format:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`my-agent/`}</p>
              <p>{`  ├── manifest.json      # Package metadata`}</p>
              <p>{`  ├── agent.yaml         # Agent configuration`}</p>
              <p>{`  ├── src/               # Source code`}</p>
              <p>{`  ├── README.md          # Documentation`}</p>
              <p>{`  └── icon.png           # Package icon`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Trust & Security</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Verified Publishers</h3>
                <p>Look for the verified badge on packages from trusted publishers.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Security Scanning</h3>
                <p>All packages are automatically scanned for vulnerabilities.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Sandboxed Execution</h3>
                <p>Marketplace agents run in isolated environments for safety.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
