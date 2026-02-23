import { BRAND_NAME } from "@/lib/brand";

const entries = [
  {
    version: "1.4.0",
    date: "Feb 18, 2026",
    tag: "Feature",
    tagColor: "status-pill pending",
    title: "Settings Hub & API Key Management",
    items: [
      "Unified settings layout with sidebar navigation",
      "API key management with scoped permissions and rotation",
      "Security settings with MFA and active session management",
      "Billing overview with usage metrics and invoice history",
      "Webhook configuration for real-time event delivery",
    ],
  },
  {
    version: "1.3.0",
    date: "Feb 10, 2026",
    tag: "Improvement",
    tagColor: "status-pill online",
    title: "PLG Growth Refactor",
    items: [
      "No-login playground for frictionless first experience",
      "Streamlined signup flow with magic-link and GitHub OAuth",
      "Onboarding checklist for new users",
      "A/B testing infrastructure for conversion optimization",
    ],
  },
  {
    version: "1.2.0",
    date: "Jan 28, 2026",
    tag: "Security",
    tagColor: "status-pill warning",
    title: "Production Hardening",
    items: [
      "RBAC enforcement with role-based access control",
      "Configuration snapshots and rollback",
      "Degraded-mode safety banner with automated detection",
      "Data retention policies and audit log",
      "Smoke test suite and entropy validation",
    ],
  },
  {
    version: "1.1.0",
    date: "Jan 15, 2026",
    tag: "Feature",
    tagColor: "status-pill pending",
    title: "Stitch Console Launch",
    items: [
      "15 console pages for agent, runner, and workflow management",
      "Trace explorer with execution timeline",
      "Governance & compliance dashboard",
      "Cost optimization and token heatmap views",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Changelog</h1>
        <p className="text-gray-400 mb-12">
          New features, improvements, and fixes for {BRAND_NAME}.
        </p>

        <div className="space-y-12">
          {entries.map((entry) => (
            <article key={entry.version} className="relative pl-8 border-l border-border">
              <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-accent -translate-x-[7px]" />
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs font-mono text-gray-500">v{entry.version}</span>
                <span className="text-xs text-gray-500">{entry.date}</span>
                <span className={`${entry.tagColor} text-xs`}>{entry.tag}</span>
              </div>
              <h2 className="text-xl font-bold mb-3">{entry.title}</h2>
              <ul className="space-y-1.5">
                {entry.items.map((item) => (
                  <li key={item} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
