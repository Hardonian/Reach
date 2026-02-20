import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agents & Roles | Reach Documentation',
  description: 'Learn about the autonomous agent roles and responsibilities within the Reach ecosystem.',
};

export default function AgentsPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-bold mb-4">Agents & Roles</h1>
        <p className="text-xl text-gray-400">
          Reach uses a specialized multi-agent system where roles are strictly defined 
          by capabilities and governance boundaries.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Autonomous Roles</h2>
        <p className="text-gray-400">
          Every agent operating within Reach is assigned a specific role. This role determines 
          the default capability set and the policy gates applied during execution.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Architecture Agent</h3>
            <p className="text-sm text-gray-400">
              Responsible for system design, maintaining invariants, and ensuring modular cohesion across the repository. 
              Owns the <code>ADR</code> (Architectural Decision Record) lifecycle.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Code Quality Agent</h3>
            <p className="text-sm text-gray-400">
              Enforces linting, typechecking, and build stability. Executes hydration and performance passes 
              and ensures vulnerability hygiene.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Design Agent</h3>
            <p className="text-sm text-gray-400">
              Ensures visual system integrity. Manages design tokens, UI coherence, and alignment with the 
              canonical brand prompts.
            </p>
          </div>
          <div className="card bg-white/5 p-6 rounded-xl border border-white/10">
            <h3 className="font-bold mb-2 text-accent">Infrastructure Agent</h3>
            <p className="text-sm text-gray-400">
              Focuses on CI resilience, environment validation, security hardening, and production deployment readiness.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Global Principles</h2>
        <div className="bg-black/40 border border-accent/20 rounded-xl p-8">
          <ul className="space-y-4 text-gray-400 font-medium">
            <li className="flex gap-4">
              <span className="text-accent shrink-0">●</span>
              <span><strong>Production-grade:</strong> Agents must never emit placeholders, TODOs, or stubs.</span>
            </li>
            <li className="flex gap-4">
              <span className="text-accent shrink-0">●</span>
              <span><strong>Deterministic Change:</strong> Prefer minimal diffs. Favor structural improvements over cosmetic ripples.</span>
            </li>
            <li className="flex gap-4">
              <span className="text-accent shrink-0">●</span>
              <span><strong>Graceful Degradation:</strong> User-facing routes managed by agents must never hard-500.</span>
            </li>
            <li className="flex gap-4">
              <span className="text-accent flex-shrink-0">●</span>
              <span><strong>High Leverage:</strong> Optimize for clarity and minimal context usage in all generated artifacts.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Injection Protocol</h2>
        <p className="text-gray-400 text-sm">
          When new constraints or skills are introduced to an agent, they follow a three-step injection protocol:
        </p>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-xs text-gray-300">
          1. Append the new capability or rule to the agent's manifest. <br/>
          2. Refine for clarity and remove any duplication with existing rules. <br/>
          3. Preserve prior valid decisions unless explicitly superseded.
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b border-border pb-2">Agent Governance</h2>
        <p className="text-gray-400">
          Agent definitions and constraints are stored in the root of the repository.
        </p>
        <ul className="space-y-2 text-sm">
          <li><code className="text-accent">/AGENTS.md</code> — Role definitions and responsibilities</li>
          <li><code className="text-accent">/SKILLS.md</code> — Skill sets and capability mappings</li>
          <li><code className="text-accent">/MODEL_SPEC.md</code> — Model constraints and routing rules</li>
        </ul>
      </section>

      <footer className="pt-8 border-t border-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Last updated: February 20, 2026</span>
        <div className="flex gap-4">
          <a href="/docs/governance" className="text-accent hover:underline">Governance Model →</a>
        </div>
      </footer>
    </div>
  );
}
