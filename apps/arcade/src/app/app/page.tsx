import Link from "next/link";

export const metadata = {
  title: "Governance App | Reach",
};

export default function AppHomePage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface/40 p-8">
        <h1 className="text-3xl font-bold">Reach Governance Control Plane</h1>
        <p className="mt-3 text-gray-400">
          Use natural language to build deterministic governance systems. Start in draft mode, then
          apply once the diff looks right.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/assistant" className="btn-primary">
            Open Assistant
          </Link>
          <Link href="/console/governance/history" className="btn-secondary">
            Governance Timeline
          </Link>
          <Link href="/docs/governance" className="btn-secondary">
            Governance Docs
          </Link>
        </div>
      </div>
    </div>
  );
}
