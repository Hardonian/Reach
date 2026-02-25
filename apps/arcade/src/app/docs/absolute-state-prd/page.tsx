import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Absolute State PRD | Reach Documentation",
  description:
    "Reach product requirement references for the Absolute State and Control Plane concepts.",
};

const prdAssets = [
  {
    title: "Reach: The Absolute State",
    description: "Product framing, key flows, and design system constraints.",
    href: "/prd/reach-the-absolute-state-prd.md",
  },
  {
    title: "Reach: The Control Plane",
    description: "Ops-center and replay-first control-plane requirements.",
    href: "/prd/reach-the-control-plane-prd.md",
  },
  {
    title: "Stitch Console Integration Manifest",
    description: "Route-to-component merge map for stitch_integrations_hub_console.zip.",
    href: "/prd/stitch-integrations-hub-console-manifest.md",
  },
  {
    title: "Stitch Absolute State PRD Manifest",
    description: "Consolidated mapping of UI prototype artifacts from the absolute-state PRD zip.",
    href: "/prd/stitch-reach-absolute-state-prd-manifest.md",
  },
];

const consoleMappings = [
  { label: "Agent Registry", href: "/console/agents" },
  { label: "Dataset Management", href: "/console/datasets" },
  { label: "Evaluation Engine", href: "/console/evaluation" },
  { label: "Integrations Hub", href: "/console/integrations" },
  { label: "Runner Orchestration", href: "/console/runners" },
  { label: "Trace Explorer", href: "/console/traces" },
];

export default function AbsoluteStatePrdPage() {
  const hasAssets = prdAssets.length > 0;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-accent font-bold">
          Product References
        </p>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          Absolute State PRD
        </h1>
        <p className="text-base text-slate-700 dark:text-slate-300 max-w-3xl">
          This bundle imports the Stitch PRD artifacts into the Reach docs surface and maps its
          console concepts onto existing authority routes to avoid duplicate dashboards.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">PRD Assets</h2>
        {hasAssets ? (
          <div className="grid gap-4 md:grid-cols-2">
            {prdAssets.map((asset) => (
              <article
                key={asset.href}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-[#111318] p-5"
              >
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {asset.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {asset.description}
                </p>
                <a
                  href={asset.href}
                  className="mt-4 inline-flex items-center text-sm font-semibold text-accent hover:underline"
                >
                  Open source document
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-600 dark:text-slate-400">
            PRD assets are unavailable. Re-import the Stitch PRD ZIP to repopulate this section.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Console Route Mapping
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Console artifacts from the Stitch integration are merged into these existing pages instead
          of creating net-new route branches.
        </p>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-[#111318] p-5">
          <ul className="grid gap-3 md:grid-cols-2">
            {consoleMappings.map((mapping) => (
              <li key={mapping.href}>
                <Link
                  href={mapping.href}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {mapping.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
        Last updated: February 25, 2026
      </footer>
    </div>
  );
}
