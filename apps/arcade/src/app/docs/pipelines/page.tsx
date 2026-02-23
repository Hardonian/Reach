export default function Pipelines() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a
            href="/docs"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Pipelines</h1>
        <p className="text-gray-400 mb-8">
          Build multi-step workflows by connecting agents, tools, and data
          sources into executable pipelines.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What are Pipelines?</h2>
            <p className="text-gray-400">
              Pipelines in ReadyLayer are declarative workflows that define how
              data flows between agents and services. They enable you to compose
              complex operations from simple, reusable components.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Pipeline Structure</h2>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# pipeline.yaml`}</p>
              <p>{`name: data-processing-pipeline`}</p>
              <p>{`version: 1.0.0`}</p>
              <p>{`description: "Process incoming data and generate reports"`}</p>
              <p>{``}</p>
              <p>{`steps:`}</p>
              <p>{`  - name: extract`}</p>
              <p>{`    agent: data-extractor`}</p>
              <p>{`    input: $.trigger.data`}</p>
              <p>{`    `}</p>
              <p>{`  - name: transform`}</p>
              <p>{`    agent: data-transformer`}</p>
              <p>{`    input: $.steps.extract.output`}</p>
              <p>{`    `}</p>
              <p>{`  - name: load`}</p>
              <p>{`    agent: data-loader`}</p>
              <p>{`    input: $.steps.transform.output`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Pipeline Concepts</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Steps</h3>
                <p>
                  Individual operations in a pipeline. Each step invokes an
                  agent or service.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Inputs & Outputs</h3>
                <p>
                  Data passed between steps using JSONPath expressions (e.g.,
                  $.steps.stepName.output).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Triggers</h3>
                <p>
                  Events that start pipeline execution: HTTP requests,
                  schedules, webhooks, or agent outputs.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Conditions</h3>
                <p>
                  Branching logic to control flow based on step results or
                  external state.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Pipeline Patterns</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Sequential</h3>
                <p className="text-gray-400 text-sm">
                  Steps execute one after another in order.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Parallel</h3>
                <p className="text-gray-400 text-sm">
                  Multiple steps execute simultaneously.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Conditional</h3>
                <p className="text-gray-400 text-sm">
                  Branch based on data or step outcomes.
                </p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Loop</h3>
                <p className="text-gray-400 text-sm">
                  Iterate over collections or retry on failure.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Error Handling</h2>
            <p className="text-gray-400 mb-4">
              Pipelines support robust error handling with retries, fallbacks,
              and compensation:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`steps:`}</p>
              <p>{`  - name: risky-operation`}</p>
              <p>{`    agent: external-api-agent`}</p>
              <p>{`    retry:`}</p>
              <p>{`      max_attempts: 3`}</p>
              <p>{`      backoff: exponential`}</p>
              <p>{`    on_error:`}</p>
              <p>{`      step: fallback-handler`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Deploying Pipelines</h2>
            <p className="text-gray-400 mb-4">
              Deploy a pipeline using the CLI:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach pipeline deploy pipeline.yaml</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
