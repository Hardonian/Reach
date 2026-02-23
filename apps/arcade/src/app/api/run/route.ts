import { NextRequest, NextResponse } from "next/server";
import { PACK_MAP } from "@/lib/packs";
import { checkRateLimit } from "@/lib/ratelimit";
import { sanitizeEvent } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const { success } = await checkRateLimit(ip);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as { packId?: unknown; inputs?: unknown };
    const { packId, inputs } = body;

    if (!packId || typeof packId !== "string") {
      return NextResponse.json(
        { error: "Invalid request: packId required" },
        { status: 400 },
      );
    }

    const pack = PACK_MAP.get(packId);

    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    if (!pack.arcadeSafe) {
      return NextResponse.json(
        {
          error:
            "Policy Violation: This pack is not authorized for Arcade execution.",
        },
        { status: 403 },
      );
    }

    // Simulate execution timeline
    // In a real implementation, this would call the Reach Runner Service
    const timeline = [
      {
        timestamp: Date.now(),
        type: "policy.gate.check",
        status: "success",
        details:
          "Allow policies: " + (pack.policyConstraints?.join(", ") || "none"),
      },
      {
        timestamp: Date.now() + 50,
        type: "execution.queued",
        status: "pending",
        id: `run-${Math.random().toString(36).substring(7)}`,
      },
      {
        timestamp: Date.now() + 200,
        type: "execution.admitted",
        status: "running",
      },
      {
        timestamp: Date.now() + 400,
        type: "tool.call",
        tool: pack.tools[0],
        inputs: inputs,
      },
      {
        timestamp: Date.now() + 800,
        type: "tool.result",
        output: "Simulated strict output result.",
      },
      {
        timestamp: Date.now() + 1000,
        type: "execution.completed",
        status: "success",
      },
    ];

    // Artificial delay for "feel"
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const responsePayload = {
      runId: `run-${Date.now()}`,
      status: "success",
      timeline,
      finalOutput: {
        message: "Execution completed successfully in Arcade Sandbox.",
        pack: pack.name,
      },
    };

    // SANITIZATION LAYER: Ensure no secrets leak
    const sanitizedPayload = sanitizeEvent(responsePayload);

    return NextResponse.json(sanitizedPayload);
  } catch (error) {
    logger.error("Runner API error", error);
    return NextResponse.json(
      { error: "Internal Runner Error" },
      { status: 500 },
    );
  }
}
