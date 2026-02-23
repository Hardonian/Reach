export default function Studio() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Studio</h1>
        <p className="text-gray-400 mb-8">
          A visual environment for building, testing, and debugging agents.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What is Studio?</h2>
            <p className="text-gray-400">
              ReadyLayer Studio is an integrated development environment (IDE) for agents. It
              provides visual tools for designing pipelines, testing agents interactively, and
              debugging executions.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Studio Features</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Visual Pipeline Builder</h3>
                <p className="text-gray-400 text-sm">
                  Drag-and-drop interface for constructing agent workflows.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Interactive Testing</h3>
                <p className="text-gray-400 text-sm">
                  Test agents in real-time with a built-in playground.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Debug Mode</h3>
                <p className="text-gray-400 text-sm">
                  Step through executions and inspect state at each point.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Live Reload</h3>
                <p className="text-gray-400 text-sm">
                  See changes instantly as you edit agent code.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Launching Studio</h2>
            <p className="text-gray-400 mb-4">Start Studio from your project directory:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>reach studio</p>
            </div>
            <p className="text-gray-400">
              This opens Studio in your default browser at http://localhost:3000/studio
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Studio Interface</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Canvas</h3>
                <p>
                  The main workspace for building pipelines. Drag agents from the sidebar and
                  connect them.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Agent Library</h3>
                <p>Browse available agents and tools. Search by name, tag, or capability.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Properties Panel</h3>
                <p>Configure selected agents, set parameters, and define connections.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Test Panel</h3>
                <p>Send test inputs and view outputs. Inspect execution traces and logs.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Building a Pipeline</h2>
            <div className="space-y-3 text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">1.</span>
                <div>Drag agents from the library onto the canvas</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">2.</span>
                <div>Connect agents by dragging from output to input ports</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">3.</span>
                <div>Configure each agent&apos;s parameters in the properties panel</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">4.</span>
                <div>Click Run to test the pipeline</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">5.</span>
                <div>View results and debug if needed</div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Testing & Debugging</h2>
            <p className="text-gray-400 mb-4">Studio provides powerful debugging tools:</p>
            <ul className="space-y-2 text-gray-400">
              <li>
                • <strong>Breakpoints:</strong> Pause execution at specific agents
              </li>
              <li>
                • <strong>Step Through:</strong> Execute one agent at a time
              </li>
              <li>
                • <strong>State Inspection:</strong> View data at any point in the pipeline
              </li>
              <li>
                • <strong>Log Viewer:</strong> Real-time logs with filtering and search
              </li>
              <li>
                • <strong>Replay:</strong> Re-run executions with the same inputs
              </li>
            </ul>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Export & Deploy</h2>
            <p className="text-gray-400 mb-4">Once your pipeline is ready:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# Export to YAML`}</p>
              <p>reach studio export pipeline.yaml</p>
              <p>{``}</p>
              <p>{`# Deploy directly`}</p>
              <p>reach studio deploy</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
