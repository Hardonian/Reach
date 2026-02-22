/**
 * ReadyLayer Analytics — Client-side event tracking
 *
 * This file is safe for client components. It only POSTs events to the API.
 * Server-side recording is in analytics-server.ts (imported only in API routes/RSC).
 */

export type EventName =
  | 'first_success_demo_run_started'
  | 'first_success_demo_run_completed'
  | 'first_success_saved_run_completed'
  | 'signup_started'
  | 'signup_completed'
  | 'oauth_signup_completed'
  | 'magic_link_signup_completed'
  | 'onboarding_checklist_completed'
  | 'onboarding_step_completed'
  | 'cta_clicked'
  | 'playground_opened'
  | 'template_applied'
  | 'ab_variant_assigned'
  | 'runtime_execution_completed';

export interface AnalyticsEvent {
  event: EventName;
  ts?: string;
  properties?: Record<string, string | number | boolean | null>;
}

/**
 * Client-side track function.
 * Fire-and-forget — never throws, never blocks UX.
 */
export async function track(
  event: EventName,
  properties?: AnalyticsEvent['properties'],
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties } satisfies AnalyticsEvent),
      keepalive: true,
    });
  } catch {
    // Non-blocking — silently ignore
  }
}
