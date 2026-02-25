"use client";

import { useEffect } from "react";

export default function TransparencyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Transparency page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="max-w-md w-full mx-auto text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-red-400 text-3xl">error</span>
        </div>
        <h2 className="text-white text-xl font-black uppercase tracking-widest mb-3">
          Failed to Load Transparency
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          An unexpected error occurred while loading the transparency governance data.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
          >
            Try Again
          </button>
          <a
            href="/"
            className="bg-surface border border-border text-gray-400 hover:text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
          >
            Go Home
          </a>
        </div>
        {error.digest && (
          <p className="mt-8 text-[10px] text-gray-600 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
