import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OSS vs Enterprise | Reach",
  description:
    "Compare Reach OSS (free, local-first) with Reach Cloud Enterprise (team governance, security, scale).",
};

export default function OssVsEnterprisePage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16 text-center">
          <h2 className="text-accent font-bold uppercase tracking-widest text-sm mb-4">
            Choose Your Path
          </h2>
          <h1 className="text-5xl font-bold mb-6">OSS vs Enterprise</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Start free with local deterministic execution. Upgrade to Enterprise when you need team
            governance, compliance, and scale.
          </p>
        </header>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* OSS */}
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Reach OSS</h3>
              <p className="text-gray-400">Free forever. Local-first.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-gray-400"> / forever</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Unlimited local deterministic runs</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Complete CLI functionality</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Capsule creation and verification</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Policy gate execution</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Local registry and packs</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>Community support</span>
              </li>
            </ul>
            <Link href="/docs" className="btn-secondary w-full block text-center">
              Install OSS
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-8 rounded-3xl bg-accent/10 border border-accent/20 relative">
            <div className="absolute -top-3 right-8 bg-accent text-black text-sm font-bold px-4 py-1 rounded-full">
              RECOMMENDED
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Reach Cloud</h3>
              <p className="text-gray-400">Enterprise governance and scale.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold">$49</span>
              <span className="text-gray-400"> / user / month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span className="font-medium">Everything in OSS, plus:</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>Cloud-hosted runners</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>Team collaboration & shared workspaces</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>Advanced analytics & dashboards</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>SOC2 compliance & audit reports</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>GitHub/GitLab CI integration</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>Priority support & SLA</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-1">✓</span>
                <span>SSO & advanced security</span>
              </li>
            </ul>
            <Link href="/contact" className="btn-primary w-full block text-center">
              Contact Sales
            </Link>
          </div>
        </div>

        {/* Feature Comparison */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-center">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-6">Feature</th>
                  <th className="text-center py-4 px-6">OSS</th>
                  <th className="text-center py-4 px-6">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Deterministic execution</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Capsule creation & replay</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Policy gates</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Local registry</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Cloud-hosted runners</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Team workspaces</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Audit dashboards</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">CI/CD integration</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">SOC2 compliance reports</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">SSO & SAML</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6">Priority support</td>
                  <td className="text-center py-4 px-6">—</td>
                  <td className="text-center py-4 px-6 text-emerald-400">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* When to Upgrade */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-center">When to Upgrade</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-bold mb-3 text-lg">Team Growth</h3>
              <p className="text-gray-400 text-sm">
                When you need to share governance policies, packs, and evaluation results across
                your team.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-bold mb-3 text-lg">Compliance Requirements</h3>
              <p className="text-gray-400 text-sm">
                When you need SOC2 reports, audit trails, and compliance documentation for
                enterprise customers.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-bold mb-3 text-lg">CI/CD Integration</h3>
              <p className="text-gray-400 text-sm">
                When you want automated determinism checks in your GitHub or GitLab pipelines.
              </p>
            </div>
          </div>
        </section>

        {/* Migration */}
        <section className="bg-accent/10 border border-accent/20 p-12 rounded-3xl">
          <h2 className="text-2xl font-bold mb-4">Seamless Migration</h2>
          <p className="text-gray-300 mb-8">
            Your local packs, capsules, and configurations work exactly the same in Enterprise. Just
            run <code className="bg-black/30 px-2 py-1 rounded">reach login</code> to connect to the
            cloud—everything else stays the same.
          </p>
          <div className="flex gap-4">
            <Link href="/docs" className="btn-primary py-3 px-8">
              Migration Guide
            </Link>
            <Link href="/contact" className="btn-secondary py-3 px-8">
              Talk to Sales
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
