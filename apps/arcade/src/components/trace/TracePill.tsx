"use client";

import Link from "next/link";
import { traceUrl, type TraceId } from "@/lib/trace/traceUrl";

interface TracePillProps {
  traceId: TraceId | string | undefined | null;
  className?: string;
}

/**
 * Compact pill display for trace IDs in tables and cards.
 * Shows truncated ID with link; degrades to empty state when absent.
 */
export function TracePill({ traceId, className }: TracePillProps) {
  if (!traceId) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 ${className ?? ""}`}
      >
        <span className="material-symbols-outlined text-[12px]">link_off</span>
        no trace
      </span>
    );
  }

  const display = traceId.length > 16 ? `${traceId.slice(0, 16)}...` : traceId;

  return (
    <Link
      href={traceUrl(traceId)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 dark:bg-blue-900/20 text-[#135bec] hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors ${className ?? ""}`}
      title={`Trace: ${traceId}`}
    >
      <span className="material-symbols-outlined text-[12px]">link</span>
      {display}
    </Link>
  );
}
