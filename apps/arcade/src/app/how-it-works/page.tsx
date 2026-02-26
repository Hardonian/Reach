import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works | Reach Deterministic Execution",
  description:
    "Learn how Reach provides deterministic, verifiable, and replayable execution for AI-driven workflows.",
};

export default function HowItWorksPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 text-center">
          <h2 className="text-accent font-bold uppercase tracking-widest text-sm mb-4">
            The Foundation
          </h2>
          <h1 className="text-5xl font-bold mb-6">How Reach Works</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            From input to proof—understand the deterministic execution pipeline that makes AI
            workflows verifiable and auditable.
          </p>
        </header>

        {/* Step 1 */}
        <section className="mb-20">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              1
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Input Canonicalization</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Every input to Reach—whether it&apos;s a natural language intent, structured policy,
                or execution context—is transformed into a canonical form. This ensures that
                semantically identical inputs produce the exact same representation, regardless of
                key ordering, whitespace, or formatting differences.
              </p>
              <div className="bg-surface rounded-xl p-6 font-mono text-sm text-gray-300">
                <div className="text-gray-500 mb-2"># Input → Canonical Form → Fingerprint</div>
                <div>{"{"}</div>
                <div className="pl-4">intent: &quot;validate user permissions&quot;,</div>
                <div className="pl-4">policy: &quot;integrity-shield&quot;,</div>
                <div className="pl-4">context: {"{}"}</div>
                <div>{"}"}</div>
                <div className="mt-2 text-accent">→ sha256:e3b0c44298fc1c149afbf4c8996fb924...</div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className="mb-20">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              2
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Policy Gate Evaluation</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Before execution begins, Reach evaluates all configured policy gates. These gates
                check for compliance, safety constraints, and integrity requirements. If any gate
                fails, execution is blocked with a detailed explanation of why.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="font-bold mb-2 text-emerald-400">Integrity Gate</h4>
                  <p className="text-sm text-gray-400">Verifies code signatures and dependencies</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="font-bold mb-2 text-emerald-400">Safety Gate</h4>
                  <p className="text-sm text-gray-400">
                    Checks for unsafe operations or data leakage
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="font-bold mb-2 text-emerald-400">Drift Gate</h4>
                  <p className="text-sm text-gray-400">Detects configuration or behavior changes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="mb-20">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              3
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Deterministic Execution</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                The Reach Runner executes your workflow in a controlled environment where all
                sources of non-determinism are eliminated or recorded. Random number generation,
                time queries, and external calls are handled consistently.
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-3">
                  <span className="text-emerald-400">✓</span>
                  Virtualized time (frozen or deterministic progression)
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-emerald-400">✓</span>
                  Seeded random number generation
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-emerald-400">✓</span>
                  Recorded external API calls for replay
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-emerald-400">✓</span>
                  Isolated filesystem operations
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Step 4 */}
        <section className="mb-20">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              4
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Evidence Chain & Proof</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Every step of execution is recorded in an immutable evidence chain. Each entry
                includes the operation performed, the state before and after, and a cryptographic
                hash linking it to the previous step. This creates a tamper-evident audit trail.
              </p>
              <div className="bg-surface rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-400 to-accent"></div>
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-accent to-purple-400"></div>
                  <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Input</span>
                  <span>Execution</span>
                  <span>Output</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 5 */}
        <section className="mb-20">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              5
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Capsule Output</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                The final output is a Capsule—a portable, self-contained package that includes the
                execution results, the complete evidence chain, and cryptographic proofs. Capsules
                can be verified, replayed, and shared with complete confidence in their integrity.
              </p>
              <div className="flex gap-4">
                <Link href="/docs" className="btn-primary">
                  Try the CLI
                </Link>
                <Link href="/playground" className="btn-secondary">
                  Run Live Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Deep Dive */}
        <section className="bg-accent/10 border border-accent/20 p-12 rounded-3xl">
          <h2 className="text-2xl font-bold mb-4">Technical Deep Dive</h2>
          <p className="text-gray-300 mb-8">
            Want to understand the determinism engine, cross-language fingerprinting, or the WASM
            bridge? Our technical specifications have the details.
          </p>
          <div className="flex gap-4">
            <Link href="/docs" className="btn-primary py-3 px-8">
              Determinism Spec
            </Link>
            <Link href="/governance" className="btn-secondary py-3 px-8">
              Whitepaper
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
