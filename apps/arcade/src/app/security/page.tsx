import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security | ReadyLayer Trust Center",
  description: "Security architecture, reporting, and compliance posture for ReadyLayer.",
};

export default function SecurityPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 text-center">
          <h2 className="text-accent font-bold uppercase tracking-widest text-sm mb-4">
            Trust Center
          </h2>
          <h1 className="text-5xl font-bold mb-6">Built for High-Stakes Autonomy</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Security isn&apos;t a feature in ReadyLayer—it&apos;s the foundational constraint. We
            enforce deterministic execution atEvery layer.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Capability Firewalls</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every tool an agent uses must be pre-declared in a signed pack manifest. The
              ReadyLayer Runner blocks any syscall, network request, or file access not explicitly
              authorized.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Boundary Redaction</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our proxy layer automatically detects and redacts secrets (API keys, PII, tokens) from
              execution logs before they reach the orchestration hub.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Tamper-Evident Logs</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every state transition is cryptographically hashed. We provide immutable Audit Reports
              as mathematical proof of how a decision was reached.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Deterministic Replay</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              By virtualizing the environment (time, PRNG, network), we ensure that a process
              running today will yield the exact same result if replayed a year from now.
            </p>
          </div>
        </div>

        <section className="bg-accent/10 border border-accent/20 p-12 rounded-3xl">
          <h2 className="text-2xl font-bold mb-4">Vulnerability Reporting</h2>
          <p className="text-gray-300 mb-8">
            We value the security community. If you&apos;ve discovered a vulnerability, please
            report it privately according to our security policy.
          </p>
          <div className="flex gap-4">
            <a href="mailto:security@reach.dev" className="btn-primary py-3 px-8">
              Report via Email
            </a>
            <Link href="/docs/security" className="btn-secondary py-3 px-8">
              Security Docs
            </Link>
          </div>
        </section>

        <footer className="mt-20 text-center text-sm text-gray-500">
          <p>
            Looking for a SOC2 report or pentest results?{" "}
            <Link href="/support" className="text-accent hover:underline">
              Contact our Enterprise team
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
