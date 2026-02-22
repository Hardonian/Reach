import { NextRequest, NextResponse } from 'next/server';
import { DecisionRepository } from '@/lib/db/decisions';
import { ActionIntentRepository } from '@/lib/db/junctions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decision = DecisionRepository.findById(id);

    if (!decision) {
      return NextResponse.json(
        { error: 'E_NOT_FOUND', message: 'Decision not found' },
        { status: 404 }
      );
    }

    // Get associated action intents
    const actionIntents = ActionIntentRepository.findByDecisionReport(id);

    return NextResponse.json({
      data: {
        ...decision,
        action_intents: actionIntents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'E_INTERNAL', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = DecisionRepository.findById(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'E_NOT_FOUND', message: 'Decision not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updated = DecisionRepository.update(id, {
      status: body.status,
      outcome_status: body.outcome_status,
      outcome_notes: body.outcome_notes,
      calibration_delta: body.calibration_delta,
      decision_output: body.decision_output,
      decision_trace: body.decision_trace,
      recommended_action_id: body.recommended_action_id,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'E_INTERNAL', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = DecisionRepository.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'E_NOT_FOUND', message: 'Decision not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      { error: 'E_INTERNAL', message: (error as Error).message },
      { status: 500 }
    );
  }
}
