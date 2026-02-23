"use client";

interface DegradedBannerProps {
  message?: string;
  visible?: boolean;
}

/**
 * Consistent Degraded Mode banner for the console.
 * Shows when system health is impaired — controls become read-only.
 */
export function DegradedBanner({
  message,
  visible = true,
}: DegradedBannerProps) {
  if (!visible) return null;

  return (
    <div
      className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-2 flex items-center gap-3"
      role="alert"
    >
      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px]">
        warning
      </span>
      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
        {message ??
          "System is operating in degraded mode. Mutating actions are temporarily disabled."}
      </span>
    </div>
  );
}
