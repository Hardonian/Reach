/**
 * Decision Outcome API Route
 *
 * POST /api/decisions/:id/outcome
 */

import { NextRequest, NextResponse } from "next/server";
import { decisionRepository } from "../../../../../lib/db/decisions";

function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/decisions/:id/outcome
 * Record decision outcome for calibration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const decision = decisionRepository.getById(id);
    if (!decision) {
      return errorResponse("E_NOT_FOUND", "Decision not found", 404);
    }

    // Validate outcome status
    const validStatuses = ["success", "failure", "mixed", "unknown"];
    if (!body.status || !validStatuses.includes(body.status)) {
      return errorResponse(
        "E_INVALID_INPUT",
        "Invalid status. Must be success, failure, mixed, or unknown",
      );
    }

    // Record outcome
    const updated = decisionRepository.recordOutcome(id, {
      status: body.status,
      notes: body.notes,
      actualScore: body.actualScore,
    });

    return NextResponse.json({
      decision: updated,
      calibrationDelta: updated?.calibration_delta,
    });
  } catch (error) {
    console.error("Error recording outcome:", error);
    return errorResponse("E_INTERNAL", "Failed to record outcome", 500);
  }
}
