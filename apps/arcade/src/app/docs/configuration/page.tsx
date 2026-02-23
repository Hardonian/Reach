export default function Configuration() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Configuration</h1>
        <p className="text-gray-400 mb-8">
          Configure your ReadyLayer environment, agents, and deployment settings.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">Global Configuration</h2>
            <p className="text-gray-400 mb-4">
              ReadyLayer uses a global configuration file located at ~/.reach/config.yaml. This file
              stores your default settings and credentials.
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# ~/.reach/config.yaml`}</p>
              <p>{`api_key: your_api_key_here`}</p>
              <p>{`default_region: us-east-1`}</p>
              <p>{`log_level: info`}</p>
              <p>{`telemetry: true`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
            <p className="text-gray-400 mb-4">
              You can also configure ReadyLayer using environment variables:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>REACH_API_KEY=your_api_key</p>
              <p>REACH_REGION=us-east-1</p>
              <p>REACH_LOG_LEVEL=debug</p>
              <p>REACH_TELEMETRY=false</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Agent Configuration</h2>
            <p className="text-gray-400 mb-4">
              Each agent has its own configuration file (agent.yaml) that defines its behavior:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`name: my-agent`}</p>
              <p>{`version: 1.0.0`}</p>
              <p>{`description: "Agent description"`}</p>
              <p>{`runtime: nodejs18`}</p>
              <p>{`capabilities:`}</p>
              <p>{`  - name: web_search`}</p>
              <p>{`    config:`}</p>
              <p>{`      max_results: 10`}</p>
              <p>{`resources:`}</p>
              <p>{`  memory: 512MB`}</p>
              <p>{`  timeout: 30s`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Deployment Configuration</h2>
            <p className="text-gray-400 mb-4">Configure deployment settings in deploy.yaml:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# deploy.yaml`}</p>
              <p>{`environment: production`}</p>
              <p>{`region: us-east-1`}</p>
              <p>{`scaling:`}</p>
              <p>{`  min_instances: 1`}</p>
              <p>{`  max_instances: 10`}</p>
              <p>{`  target_cpu: 70`}</p>
              <p>{`env_vars:`}</p>
              <p>{`  API_URL: https://api.example.com`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Configuration Precedence</h2>
            <p className="text-gray-400 mb-4">
              Settings are applied in the following order (later overrides earlier):
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-400">
              <li>Default values</li>
              <li>Global config file (~/.reach/config.yaml)</li>
              <li>Project config file (./reach.yaml)</li>
              <li>Environment variables</li>
              <li>Command-line flags</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
