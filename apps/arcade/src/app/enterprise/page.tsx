import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function EnterprisePage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <header className="mb-20 text-center">
          <div className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-accent uppercase bg-accent/10 rounded-full border border-accent/20">
            For Mission-Critical AI
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
            Enterprise <span className="text-gradient">Governance</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed border-l-4 border-accent pl-6 text-left italic">
            "Reach (OSS) is the engine. ReadyLayer Enterprise is the control plane for organizations
            who cannot afford to be wrong or unauditable."
          </p>
        </header>

        {/* Core Pillars */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <div className="card gradient-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🛡️</span> Immutable Auditability
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Every decision made by an agent is cryptographically signed and stored in a
              tamper-evident hash ladder. Satisfy SOC2, HIPAA, and GDPR requirements with
              bit-identical replay of any production event.
            </p>
            <ul className="text-xs space-y-2 text-gray-500">
              <li>• Signed Transcripts (Capsules)</li>
              <li>• Automated SOC2 Artifact Generation</li>
              <li>• Cryptographic Provenance Chains</li>
            </ul>
          </div>

          <div className="card gradient-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">⚖️</span> Agent Contracts & SLAs
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Enforce strict behavioral boundaries. If an agent attempts to exceed its budget,
              violate safety policies, or drift from its deterministic baseline, ReadyLayer blocks
              the execution instantly.
            </p>
            <ul className="text-xs space-y-2 text-gray-500">
              <li>• Real-time Drift Guard</li>
              <li>• Budget & Safety Hard Gates</li>
              <li>• Performance SLA Enforcement</li>
            </ul>
          </div>

          <div className="card gradient-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🏢</span> Single-Tenant Isolation
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Deploy your own private instance of the ReadyLayer control plane. Keep your execution
              logs, policy data, and vector context within your own VPC.
            </p>
            <ul className="text-xs space-y-2 text-gray-500">
              <li>• VPC/On-Prem Deployment</li>
              <li>• Dedicated Compute Nodes</li>
              <li>• Zero-Knowledge Data Handling</li>
            </ul>
          </div>

          <div className="card gradient-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">👨‍👩‍👧‍👦</span> Team Orchestration
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Manage multi-tenant environments with granular RBAC. Share skill packs across teams
              while maintaining strict permission boundaries.
            </p>
            <ul className="text-xs space-y-2 text-gray-500">
              <li>• GitHub OAuth + Magic Link Authentication</li>
              <li>• Role-Based Access Control (RBAC)</li>
              <li>• Team-based Policy Scoping</li>
              <li>• Centralized Governance Dashboard</li>
              <li>• SAML/SCIM (Enterprise Roadmap Q2)</li>
            </ul>
          </div>
        </div>

        {/* Comparison Section Link */}
        <div className="text-center bg-surface/50 p-12 rounded-3xl border border-border">
          <h2 className="text-3xl font-bold mb-6">Built on the Reach Open-Source Protocol</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            ReadyLayer Enterprise extends the core Reach engine with the high-availability and
            compliance infrastructure required by modern businesses.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={ROUTES.PRICING} className="btn-primary px-8">
              View Comparison Table
            </Link>
            <Link href={ROUTES.CONTACT} className="btn-secondary px-8">
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
