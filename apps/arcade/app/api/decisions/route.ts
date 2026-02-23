/**
 * Decisions API Route
 *
 * REST API for Decision Pillar.
 */

import { NextRequest, NextResponse } from "next/server";
import { decisionRepository } from "../../../lib/db/decisions";
import {
  getDefaultEngine,
  DecisionInputSchema,
} from "../../../lib/decision/engineAdapter";

/**
 * Standard error response
 */
function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/decisions
 * List decisions with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get("status") as
      | "draft"
      | "evaluated"
      | "reviewed"
      | "accepted"
      | "rejected"
      | "superseded"
      | null;
    const sourceType = searchParams.get("sourceType") as
      | "diff"
      | "drift"
      | "policy"
      | "trust"
      | "manual"
      | null;
    const workspaceId = searchParams.get("workspaceId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = decisionRepository.list({
      status: status || undefined,
      sourceType: sourceType || undefined,
      workspaceId: workspaceId || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      decisions: result.decisions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error listing decisions:", error);
    return errorResponse("E_INTERNAL", "Failed to list decisions", 500);
  }
}

/**
 * POST /api/decisions
 * Create a new decision
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = DecisionInputSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(
        "E_SCHEMA",
        `Invalid input: ${parseResult.error.message}`,
      );
    }

    const input = parseResult.data;

    // Generate deterministic fingerprint
    const canonicalJson = JSON.stringify(input, Object.keys(input).sort());
    const fingerprint = hashString(canonicalJson);

    // Check for duplicate (same fingerprint within recent decisions)
    const existing = decisionRepository.getByFingerprint(fingerprint);
    if (existing) {
      return NextResponse.json({
        duplicate: true,
        decision: existing,
        message: "Decision with same evidence already exists",
      });
    }

    // Create decision record
    const decision = decisionRepository.create({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      inputFingerprint: fingerprint,
      decisionInput: JSON.stringify(input),
    });

    // Evaluate with decision engine
    const engine = getDefaultEngine();
    const result = await engine.evaluate(input);

    // Update decision with output
    const updated = decisionRepository.updateOutput(decision.id, {
      decisionOutput: JSON.stringify(result),
      decisionTrace: JSON.stringify(result.decisionTrace),
      recommendedActionId: result.bestAction?.id,
      governanceBadges: result.governanceBadges
        ? JSON.stringify(result.governanceBadges)
        : undefined,
    });

    return NextResponse.json(
      {
        decision: updated,
        evaluation: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating decision:", error);
    return errorResponse("E_INTERNAL", "Failed to create decision", 500);
  }
}

/**
 * Simple hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
