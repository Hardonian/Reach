import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deterministic Engine | Reach Documentation',
  description: 'Technical deep dive into the Reach deterministic execution core.',
};

export default function EnginePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold mb-4">Deterministic Engine</h1>
        <p className="text-xl text-gray-400">
          The heart of Reach is an immutable, event-driven execution core that guarantees replayability.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold border-b border-border pb-2">How it Works</h2>
        <p>
          Unlike standard execution environments, the Reach engine captures every side effect, tool call, 
          and state transition within a signed capsule. 
        </p>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-sm">
          Execution = (Signed Pack + Input State + Policy Gate) -> Verifiable Capsule
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">Key Invariants</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>No Hidden Randomness:</strong> All PRNGs are seeded from the session hash.</li>
          <li><strong>Sealed Time:</strong> System clock access is virtualized and deterministic.</li>
          <li><strong>Network Isolation:</strong> All external calls must be proxied via MCP tools with explicit capabilities.</li>
        </ul>
      </section>
    </div>
  );
}
