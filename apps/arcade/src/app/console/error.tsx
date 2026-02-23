"use client";

import { useEffect } from "react";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Console error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#101622] flex items-center justify-center font-sans">
      <div className="max-w-md w-full mx-auto text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-red-400 text-3xl">
            error
          </span>
        </div>
        <h2 className="text-white text-xl font-black uppercase tracking-widest mb-3">
          Console Error
        </h2>
        <p className="text-[#9da6b9] text-sm mb-8">
          An unexpected error occurred. The team has been notified.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
          >
            Try Again
          </button>
          <a
            href="/console"
            className="bg-[#1e293b] border border-slate-700/50 text-[#9da6b9] hover:text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
          >
            Back to Dashboard
          </a>
        </div>
        {error.digest && (
          <p className="mt-8 text-[10px] text-slate-600 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
