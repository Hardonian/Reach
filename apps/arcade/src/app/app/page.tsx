import Link from "next/link";
import { envValidation } from "@/lib/env";

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

        {!envValidation.ok && (
          <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p className="font-medium">Some environment values were ignored.</p>
            <p className="mt-1">
              Governance routes stay available in degraded mode. Fix configuration for full cloud
              behavior.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
