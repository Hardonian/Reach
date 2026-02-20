export default function Agents() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Agents</h1>
        <p className="text-gray-400 mb-8">
          Understand how Reach agents work, their lifecycle, and how to build powerful autonomous capabilities.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What is an Agent?</h2>
            <p className="text-gray-400">
              An agent in Reach is an autonomous software entity that can perceive its environment, make decisions, and take actions to achieve specific goals. Agents can be simple task automators or complex AI systems capable of reasoning and learning.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Agent Structure</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Manifest (agent.yaml)</h3>
                <p>Defines the agent&apos;s identity, version, capabilities, and metadata.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Entry Point</h3>
                <p>The main code file that handles incoming requests and orchestrates behavior.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Capabilities</h3>
                <p>Modular components that provide specific functionality (APIs, tools, integrations).</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">State</h3>
                <p>Persistent storage for agent memory and context across invocations.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Agent Lifecycle</h2>
            <div className="space-y-3 text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">1.</span>
                <div>
                  <span className="font-semibold text-white">Create:</span> Define agent manifest and implement logic
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">2.</span>
                <div>
                  <span className="font-semibold text-white">Build:</span> Package agent and dependencies
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">3.</span>
                <div>
                  <span className="font-semibold text-white">Test:</span> Validate behavior in local environment
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">4.</span>
                <div>
                  <span className="font-semibold text-white">Deploy:</span> Publish to Reach network
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">5.</span>
                <div>
                  <span className="font-semibold text-white">Execute:</span> Handle requests and perform tasks
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">6.</span>
                <div>
                  <span className="font-semibold text-white">Monitor:</span> Track performance and health
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Agent Types</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Task Agents</h3>
                <p className="text-gray-400 text-sm">Execute specific, well-defined tasks like data processing or API calls.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Conversational Agents</h3>
                <p className="text-gray-400 text-sm">Handle natural language interactions and maintain context.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Orchestrator Agents</h3>
                <p className="text-gray-400 text-sm">Coordinate multiple agents and manage complex workflows.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Autonomous Agents</h3>
                <p className="text-gray-400 text-sm">Self-directed agents that can plan and execute multi-step goals.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Example Agent</h2>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`// agent.js`}</p>
              <p>{`export default async function handler(request, context) {`}</p>
              <p>{`  const { message } = request.body;`}</p>
              <p>{`  `}</p>
              <p>{`  // Process the request`}</p>
              <p>{`  const response = await context.llm.complete({`}</p>
              <p>{`    prompt: \`User said: \${message}\`,`}</p>
              <p>{`    model: 'gpt-4'`}</p>
              <p>{`  });`}</p>
              <p>{`  `}</p>
              <p>{`  return {`}</p>
              <p>{`    status: 200,`}</p>
              <p>{`    body: { reply: response.text }`}</p>
              <p>{`  };`}</p>
              <p>{`}`}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
