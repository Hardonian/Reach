export default function Endpoints() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Endpoints</h1>
        <p className="text-gray-400 mb-8">Complete reference for the ReadyLayer REST API.</p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">Base URL</h2>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>https://api.reach.dev/v1</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Agents</h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/agents</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">List all agents</p>
                <div className="bg-black/50 p-3 rounded-lg font-mono text-xs text-gray-300">
                  <p>curl https://api.reach.dev/v1/agents \</p>
                  <p>{`  -H "Authorization: Bearer $API_KEY"`}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">POST</span>
                  <code className="text-accent">/agents</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">Create a new agent</p>
                <div className="bg-black/50 p-3 rounded-lg font-mono text-xs text-gray-300">
                  <p>curl -X POST https://api.reach.dev/v1/agents</p>
                  <p>{`  -H "Authorization: Bearer $API_KEY"`}</p>
                  <p>{`  -H "Content-Type: application/json"`}</p>
                  <p>{`  -d '{"name": "my-agent", "runtime": "nodejs18"}'`}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/agents/&#123;id&#125;</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">Get agent details</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded">PUT</span>
                  <code className="text-accent">/agents/&#123;id&#125;</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">Update an agent</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">DELETE</span>
                  <code className="text-accent">/agents/&#123;id&#125;</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">Delete an agent</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">POST</span>
                  <code className="text-accent">/agents/&#123;id&#125;/execute</code>
                </div>
                <p className="text-gray-400 text-sm mb-2">Execute an agent</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Pipelines</h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/pipelines</code>
                </div>
                <p className="text-gray-400 text-sm">List all pipelines</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">POST</span>
                  <code className="text-accent">/pipelines</code>
                </div>
                <p className="text-gray-400 text-sm">Create a pipeline</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">POST</span>
                  <code className="text-accent">/pipelines/&#123;id&#125;/run</code>
                </div>
                <p className="text-gray-400 text-sm">Execute a pipeline</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Executions</h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/executions</code>
                </div>
                <p className="text-gray-400 text-sm">List executions</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/executions/&#123;id&#125;</code>
                </div>
                <p className="text-gray-400 text-sm">Get execution details</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">GET</span>
                  <code className="text-accent">/executions/&#123;id&#125;/logs</code>
                </div>
                <p className="text-gray-400 text-sm">Get execution logs</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Response Format</h2>
            <p className="text-gray-400 mb-4">All API responses follow a standard format:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`{`}</p>
              <p>{`  "success": true,`}</p>
              <p>{`  "data": { ... },`}</p>
              <p>{`  "meta": {`}</p>
              <p>{`    "request_id": "req_123",`}</p>
              <p>{`    "timestamp": "2024-01-15T10:30:00Z"`}</p>
              <p>{`  }`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Error Handling</h2>
            <p className="text-gray-400 mb-4">Error responses include a code and message:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`{`}</p>
              <p>{`  "success": false,`}</p>
              <p>{`  "error": {`}</p>
              <p>{`    "code": "AGENT_NOT_FOUND",`}</p>
              <p>{`    "message": "Agent with ID 'abc' not found",`}</p>
              <p>{`    "status": 404`}</p>
              <p>{`  }`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Rate Limits</h2>
            <div className="bg-black/50 p-4 rounded-lg text-gray-400">
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Standard Tier</span>
                <span>1000 requests/minute</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Pro Tier</span>
                <span>10000 requests/minute</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Enterprise</span>
                <span>Custom limits</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
