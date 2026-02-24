import Link from "next/link";

export const metadata = {
  title: "Governance History | Reach",
};

export default function GovernanceHistoryPublicPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface/40 p-8">
        <h1 className="text-3xl font-bold">Governance Timeline</h1>
        <p className="mt-3 text-gray-400">
          View deterministic governance changes with diff, actor attribution, replay links, and hash
          proofs.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/console/governance/history" className="btn-primary">
            Open Timeline
          </Link>
          <Link href="/assistant" className="btn-secondary">
            Create New Governance Draft
          </Link>
        </div>
      </div>
    </div>
  );
}
