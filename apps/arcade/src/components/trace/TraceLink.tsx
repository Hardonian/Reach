'use client';

import Link from 'next/link';
import { traceUrl, type TraceId } from '@/lib/trace/traceUrl';

interface TraceLinkProps {
  traceId: TraceId | string | undefined | null;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Standard component for linking to a trace.
 * Renders as a disabled span when traceId is absent — never crashes.
 */
export function TraceLink({ traceId, className, children }: TraceLinkProps) {
  if (!traceId) {
    return (
      <span
        className={`text-slate-400 cursor-not-allowed ${className ?? ''}`}
        title="No trace available"
      >
        {children ?? '—'}
      </span>
    );
  }

  return (
    <Link
      href={traceUrl(traceId)}
      className={`text-[#135bec] hover:underline font-mono text-xs ${className ?? ''}`}
      title={`View trace ${traceId}`}
    >
      {children ?? traceId}
    </Link>
  );
}
