/**
 * ReadyLayer Analytics — Server-side event recording
 *
 * DO NOT import this file in client components.
 * Use analytics.ts (track) for client-side event submission.
 */

import type { AnalyticsEvent } from "./analytics";
import { logger } from "./logger";

/**
 * Server-side record function.
 * Writes to DB if cloud is enabled, otherwise logs.
 */
export function recordEvent(event: AnalyticsEvent): void {
  void (async () => {
    try {
      const { appendEvent } = await import("./cloud-db");
      appendEvent(event.event, event.properties ?? {}, event.ts ?? new Date().toISOString());
    } catch (error) {
      logger.warn("analytics event persistence unavailable", {
        event: event.event,
        has_properties: Boolean(event.properties),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
