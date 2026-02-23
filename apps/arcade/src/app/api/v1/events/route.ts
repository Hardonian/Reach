import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics-server";
import type { AnalyticsEvent } from "@/lib/analytics";
import { checkRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const VALID_EVENTS = new Set([
  "first_success_demo_run_started",
  "first_success_demo_run_completed",
  "first_success_saved_run_completed",
  "signup_started",
  "signup_completed",
  "oauth_signup_completed",
  "magic_link_signup_completed",
  "onboarding_checklist_completed",
  "onboarding_step_completed",
  "cta_clicked",
  "playground_opened",
  "template_applied",
  "ab_variant_assigned",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit: 60 events/min per IP
    const ip =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { success } = await checkRateLimit(ip, 60, 60);
    if (!success) {
      return NextResponse.json(
        { ok: false, error: "Rate limited" },
        { status: 429 },
      );
    }

    const body = (await req
      .json()
      .catch(() => ({}))) as Partial<AnalyticsEvent>;
    const { event, properties } = body;

    if (!event || !VALID_EVENTS.has(event)) {
      return NextResponse.json(
        { ok: false, error: "Unknown event" },
        { status: 400 },
      );
    }

    // Sanitize properties — only allow primitive values
    const safeProps: Record<string, string | number | boolean | null> = {};
    if (properties && typeof properties === "object") {
      for (const [k, v] of Object.entries(properties)) {
        if (
          k.length <= 64 &&
          (typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean" ||
            v === null)
        ) {
          safeProps[k.slice(0, 64)] =
            typeof v === "string" ? v.slice(0, 256) : v;
        }
      }
    }

    recordEvent({ event, properties: safeProps, ts: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Events route error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
