import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordEvent } from "@/lib/analytics-server";
import { executeRun, generateArtifacts } from "@/lib/runtime";
import type { ExecutionMode, RoutingStrategy } from "@/lib/runtime";

export const runtime = "nodejs";

interface ExecuteBody {
  skill_id: string;
  inputs?: Record<string, unknown>;
  mode?: ExecutionMode;
  routing_strategy?: RoutingStrategy;
  preferred_provider?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { success } = await checkRateLimit(ip, 10, 60);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.skill_id) {
    return NextResponse.json(
      { error: "skill_id is required" },
      { status: 400 },
    );
  }

  // Simulate processing delay
  await new Promise((r) =>
    setTimeout(r, 400 + Math.floor(Math.random() * 400)),
  );

  const graph = executeRun({
    skillId: body.skill_id,
    inputs: body.inputs ?? {},
    mode: body.mode ?? "browser",
    routingStrategy: body.routing_strategy,
    preferredProvider: body.preferred_provider,
  });

  const artifacts = generateArtifacts(graph);

  recordEvent({
    event: "runtime_execution_completed",
    properties: {
      skill_id: body.skill_id,
      mode: graph.mode,
      status: graph.status,
      duration_ms: graph.totalDurationMs,
      provider: graph.provider.providerId,
    },
    ts: new Date().toISOString(),
  });

  return NextResponse.json({ graph, artifacts });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message:
      "POST to execute a skill run. Returns execution graph and artifacts.",
    example_body: {
      skill_id: "readiness-check",
      inputs: { agent_trace: {} },
      mode: "browser",
      routing_strategy: "default",
    },
  });
}
