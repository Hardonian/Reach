import { NextRequest, NextResponse } from 'next/server';
import { DecisionRepository } from '@/lib/db/decisions';
import { ActionIntentRepository } from '@/lib/db/junctions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceType = searchParams.get('sourceType');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const decisions = DecisionRepository.list({
      sourceType: sourceType || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: decisions,
      meta: {
        count: decisions.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'E_INTERNAL', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.source_type || !body.source_ref || !body.decision_input) {
      return NextResponse.json(
        { error: 'E_INVALID_INPUT', message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const decision = DecisionRepository.create({
      source_type: body.source_type,
      source_ref: body.source_ref,
      scope_keys: body.scope_keys,
      input_fingerprint: body.input_fingerprint || '',
      decision_input: body.decision_input,
      decision_output: body.decision_output,
      decision_trace: body.decision_trace,
      recommended_action_id: body.recommended_action_id,
      status: body.status || 'draft',
      outcome_status: body.outcome_status || 'unknown',
      outcome_notes: body.outcome_notes,
      calibration_delta: body.calibration_delta,
    });

    return NextResponse.json({ data: decision }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'E_INTERNAL', message: (error as Error).message },
      { status: 500 }
    );
  }
}
