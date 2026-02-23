import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordEvent } from "@/lib/analytics-server";

export const runtime = "nodejs";

/**
 * Public playground endpoint — no auth required.
 * Returns a deterministic demo run result using canned fixture data.
 * Rate limited to prevent abuse.
 */

interface PlaygroundResult {
  run_id: string;
  status: "pass" | "needs_attention" | "fail";
  score: number;
  findings: Array<{
    id: string;
    severity: "high" | "medium" | "low";
    category: string;
    title: string;
    detail: string;
    fix: string;
  }>;
  summary: string;
  duration_ms: number;
  checks_run: number;
  checks_passed: number;
  agent_name: string;
  template_id: string;
}

/** Demo fixture — deterministic, realistic, safe */
const DEMO_RESULT: PlaygroundResult = {
  run_id: "demo_run_001",
  status: "needs_attention",
  score: 74,
  findings: [
    {
      id: "f001",
      severity: "high",
      category: "Tool reliability",
      title: "Tool call timeout exceeded",
      detail: '"search_web" exceeded the 2s timeout budget on 2 of 5 runs (p95: 3.1s).',
      fix: "Set `timeout_ms: 1500` on the search_web tool. Add a fallback for slow responses.",
    },
    {
      id: "f002",
      severity: "medium",
      category: "Policy gate",
      title: "Unguarded external call",
      detail: "The agent calls an external API without checking the allow-list rule.",
      fix: "Add `external_calls: [approved-apis]` to your policy config.",
    },
    {
      id: "f003",
      severity: "low",
      category: "Regression",
      title: "Output format drift",
      detail: "Response schema changed from v1 baseline — `confidence` field dropped in 1 case.",
      fix: "Pin your output schema or update the baseline after the intentional change.",
    },
  ],
  summary: "3 findings: 1 high, 1 medium, 1 low. Fix the tool timeout to unblock shipping.",
  duration_ms: 847,
  checks_run: 12,
  checks_passed: 9,
  agent_name: "demo-research-agent",
  template_id: "agent-readiness-baseline",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

  // Rate limit: 10 playground runs per minute per IP
  const { success } = await checkRateLimit(ip, 10, 60);
  if (!success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment before running again.",
      },
      { status: 429 },
    );
  }

  // Parse optional template_id from body
  let templateId = "agent-readiness-baseline";
  try {
    const body = (await req.json().catch(() => ({}))) as {
      template_id?: string;
    };
    if (body.template_id) templateId = String(body.template_id).slice(0, 64);
  } catch {
    /* ignore */
  }

  // Realistic processing delay
  await new Promise((r) => setTimeout(r, 600 + Math.floor(Math.random() * 400)));

  const result = { ...DEMO_RESULT, template_id: templateId };

  recordEvent({
    event: "first_success_demo_run_completed",
    properties: {
      source: "playground",
      template_id: templateId,
      result_status: result.status,
      duration_ms: result.duration_ms,
    },
    ts: new Date().toISOString(),
  });

  return NextResponse.json(result);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: "POST to this endpoint to run a demo check. No auth required.",
    example_body: { template_id: "agent-readiness-baseline" },
    rate_limit: "10 runs/minute per IP",
  });
}
