/**
 * ReadyLayer Analytics — Server-side event recording
 *
 * DO NOT import this file in client components.
 * Use analytics.ts (track) for client-side event submission.
 */

import type { AnalyticsEvent } from "./analytics";

/**
 * Server-side record function.
 * Writes to DB if cloud is enabled, otherwise logs.
 */
export function recordEvent(event: AnalyticsEvent): void {
  void (async () => {
    try {
      const { appendEvent } = await import("./cloud-db.js");
      appendEvent(event.event, event.properties ?? {}, event.ts ?? new Date().toISOString());
    } catch {
      // DB not available — log only
      console.info("[analytics]", event.event, event.properties);
    }
  })();
}
