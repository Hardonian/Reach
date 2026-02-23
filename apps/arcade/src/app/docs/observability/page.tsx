import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Observability | ReadyLayer Documentation",
  description: "Monitoring and debugging agentic workloads with ReadyLayer.",
};

export default function ObservabilityPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold mb-4">Observability</h1>
        <p className="text-xl text-gray-400">
          Real-time insights into agent reasoning, tool usage, and policy compliance.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="font-bold mb-2">Event Streams</h3>
          <p className="text-sm text-gray-400">
            Every ReadyLayer node emits a high-fidelity OpenTelemetry event stream containing
            execution logs and metric labels.
          </p>
        </div>
        <div className="card p-6 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="font-bold mb-2">Audit Capsules</h3>
          <p className="text-sm text-gray-400">
            Immutable snapshots of completed runs, including model inputs, tool outputs, and
            decision paths.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Integration Ports</h2>
        <ul className="space-y-2">
          <li>
            <code>:4317</code> - OTLP gRPC ingest
          </li>
          <li>
            <code>:4318</code> - OTLP HTTP ingest
          </li>
          <li>
            <code>:9090</code> - Prometheus scrapable metrics
          </li>
        </ul>
      </section>
    </div>
  );
}
