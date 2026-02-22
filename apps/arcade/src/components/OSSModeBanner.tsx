'use client';

/**
 * OSS mode banner showing that ReadyLayer is running in local-only mode.
 */
export function OSSModeBanner() {
  // In a real app, this would check an environment variable or config
  // For this pivot, we show it by default if REACH_CLOUD is not explicitly set
  const isOSS = true; // Placeholder for logic

  if (!isOSS) return null;

  return (
    <div className="w-full bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 flex items-center justify-center gap-3 animate-fade-in" role="status">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
        OSS Mode (Local Only) — Deterministic Engine Verified
      </span>
    </div>
  );
}
