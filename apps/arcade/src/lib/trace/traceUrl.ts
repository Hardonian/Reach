import { ROUTES } from "@/lib/routes";

/**
 * Canonical Trace ID type — branded string for type safety.
 * All trace identifiers flowing through the UI should use this type.
 */
export type TraceId = string & { readonly __brand: "TraceId" };

/**
 * Constructs the canonical URL for a given trace ID.
 * Single source of truth for trace deep-link format.
 */
export function traceUrl(traceId: TraceId | string): string {
  if (!traceId) return ROUTES.CONSOLE.TRACES;
  return `${ROUTES.CONSOLE.TRACES}?trace=${encodeURIComponent(traceId)}`;
}

/**
 * Validates that a string looks like a plausible trace ID.
 * Does not verify existence — only format.
 */
export function isValidTraceId(value: string): value is TraceId {
  return typeof value === "string" && value.length >= 4 && value.length <= 128;
}
