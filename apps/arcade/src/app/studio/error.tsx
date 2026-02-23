"use client";

import { useEffect } from "react";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Studio error:", error);
  }, [error]);

  return (
    <div className="section-container py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">🎨</div>
        <h2 className="text-2xl font-bold mb-4">Studio Error</h2>
        <p className="text-gray-400 mb-8">
          Unable to load the orchestration studio. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={reset} className="btn-primary">
            Try Again
          </button>
          <a href="/" className="btn-secondary">
            Go Home
          </a>
        </div>
        {error.digest && (
          <p className="mt-8 text-xs text-gray-600 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
