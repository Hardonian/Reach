"use client";

import { useEffect } from "react";

export default function AbsoluteStatePrdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Absolute State PRD route error", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 space-y-3">
      <h2 className="text-lg font-semibold text-red-300">PRD documentation failed to load</h2>
      <p className="text-sm text-red-100/90">
        Try reloading this page. If the issue persists, verify the PRD asset files under
        `apps/arcade/public/prd`.
      </p>
      <button type="button" onClick={reset} className="btn-secondary text-xs py-2 px-4">
        Retry
      </button>
      {error.digest ? (
        <p className="text-[11px] text-red-100/70">Error ID: {error.digest}</p>
      ) : null}
    </div>
  );
}
