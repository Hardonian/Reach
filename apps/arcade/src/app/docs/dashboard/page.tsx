export default function Dashboard() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400 mb-8">
          Monitor, manage, and control your agents from a centralized web interface.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">Overview</h2>
            <p className="text-gray-400">
              The ReadyLayer Dashboard provides a unified view of your agents, pipelines, and
              platform metrics. Access real-time monitoring, logs, and management controls from any
              browser.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Dashboard Features</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Agent Management</h3>
                <p className="text-gray-400 text-sm">
                  View, deploy, update, and monitor all your agents in one place.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Real-time Metrics</h3>
                <p className="text-gray-400 text-sm">
                  Track execution count, latency, error rates, and resource usage.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Logs & Traces</h3>
                <p className="text-gray-400 text-sm">
                  Search and filter logs across all agents with full trace visibility.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Team Collaboration</h3>
                <p className="text-gray-400 text-sm">
                  Share agents, manage permissions, and collaborate with your team.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Accessing the Dashboard</h2>
            <p className="text-gray-400 mb-4">The Dashboard is available at:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>https://reach.dev/dashboard</p>
            </div>
            <p className="text-gray-400">Or run locally when developing:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach dashboard</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Dashboard Sections</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Home</h3>
                <p>Overview of recent activity, popular agents, and key metrics at a glance.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Agents</h3>
                <p>List of all your agents with status, version, and quick actions.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Pipelines</h3>
                <p>Visual workflow editor and pipeline execution history.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Analytics</h3>
                <p>Detailed metrics, usage trends, and performance insights.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Settings</h3>
                <p>Organization settings, billing, integrations, and API keys.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Keyboard Shortcuts</h2>
            <div className="grid md:grid-cols-2 gap-4 text-gray-400">
              <div className="flex justify-between">
                <span>Quick search</span>
                <kbd className="bg-black/50 px-2 py-1 rounded">Ctrl+K</kbd>
              </div>
              <div className="flex justify-between">
                <span>New agent</span>
                <kbd className="bg-black/50 px-2 py-1 rounded">Ctrl+N</kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle sidebar</span>
                <kbd className="bg-black/50 px-2 py-1 rounded">Ctrl+B</kbd>
              </div>
              <div className="flex justify-between">
                <span>Focus logs</span>
                <kbd className="bg-black/50 px-2 py-1 rounded">Ctrl+L</kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
