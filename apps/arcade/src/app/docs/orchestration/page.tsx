export default function Orchestration() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Orchestration</h1>
        <p className="text-gray-400 mb-8">
          Coordinate multiple agents, manage distributed execution, and handle complex workflows at scale.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What is Orchestration?</h2>
            <p className="text-gray-400">
              Orchestration in ReadyLayer manages the coordination of multiple agents working together to achieve complex goals. It handles scheduling, state management, error recovery, and scaling across distributed infrastructure.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Orchestration Modes</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Centralized</h3>
                <p>A single orchestrator agent coordinates all other agents. Best for structured workflows with clear dependencies.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Decentralized</h3>
                <p>Agents communicate peer-to-peer using a shared message bus. Best for flexible, emergent behavior.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Hierarchical</h3>
                <p>Multi-level orchestration with parent agents managing child agents. Best for complex organizations.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Key Concepts</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Workflow Engine</h3>
                <p className="text-gray-400 text-sm">Executes defined workflows with state persistence and recovery.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Agent Discovery</h3>
                <p className="text-gray-400 text-sm">Dynamic discovery of available agents and their capabilities.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Load Balancing</h3>
                <p className="text-gray-400 text-sm">Distribute work across agent instances based on capacity.</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Fault Tolerance</h3>
                <p className="text-gray-400 text-sm">Automatic recovery from agent failures with retry and fallback.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Orchestrator Agent Example</h2>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`// orchestrator.js`}</p>
              <p>{`export default async function handler(request, context) {`}</p>
              <p>{`  const { task } = request.body;`}</p>
              <p>{`  `}</p>
              <p>{`  // Decompose task into subtasks`}</p>
              <p>{`  const subtasks = await decompose(task);`}</p>
              <p>{`  `}</p>
              <p>{`  // Dispatch to worker agents`}</p>
              <p>{`  const results = await Promise.all(`}</p>
              <p>{`    subtasks.map(st => context.agents.dispatch('worker', st))`}</p>
              <p>{`  );`}</p>
              <p>{`  `}</p>
              <p>{`  // Aggregate results`}</p>
              <p>{`  return {`}</p>
              <p>{`    status: 200,`}</p>
              <p>{`    body: { results }`}</p>
              <p>{`  };`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">State Management</h2>
            <p className="text-gray-400 mb-4">
              Orchestrated workflows maintain state across distributed executions:
            </p>
            <ul className="space-y-2 text-gray-400">
              <li>• <strong>Workflow State:</strong> Current step, variables, and execution context</li>
              <li>• <strong>Agent State:</strong> Individual agent memory and configuration</li>
              <li>• <strong>Shared State:</strong> Distributed key-value store for coordination</li>
              <li>• <strong>Event Log:</strong> Immutable record of all workflow events</li>
            </ul>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Scaling Patterns</h2>
            <div className="space-y-3 text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <div>
                  <span className="font-semibold text-white">Horizontal Scaling:</span> Add more agent instances to handle increased load
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <div>
                  <span className="font-semibold text-white">Sharding:</span> Partition work across multiple orchestrators
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <div>
                  <span className="font-semibold text-white">Priority Queues:</span> Handle critical tasks before background work
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
