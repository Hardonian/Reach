/**
 * Individual Decision API Route
 * 
 * GET/PUT /api/decisions/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { decisionRepository, actionIntentRepository } from '../../../../lib/db/decisions';

function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/decisions/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decision = decisionRepository.getById(id);
    
    if (!decision) {
      return errorResponse('E_NOT_FOUND', 'Decision not found', 404);
    }
    
    // Get action intents for this decision
    const actionIntents = actionIntentRepository.getByDecisionId(id);
    
    return NextResponse.json({
      decision,
      actionIntents,
    });
  } catch (error) {
    console.error('Error getting decision:', error);
    return errorResponse('E_INTERNAL', 'Failed to get decision', 500);
  }
}

/**
 * PUT /api/decisions/:id
 * Update decision status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const decision = decisionRepository.getById(id);
    if (!decision) {
      return errorResponse('E_NOT_FOUND', 'Decision not found', 404);
    }
    
    // Handle status update
    if (body.status) {
      const validStatuses = ['draft', 'evaluated', 'reviewed', 'accepted', 'rejected', 'superseded'];
      if (!validStatuses.includes(body.status)) {
        return errorResponse('E_INVALID_INPUT', 'Invalid status');
      }
      
      const updated = decisionRepository.updateStatus(id, body.status);
      return NextResponse.json({ decision: updated });
    }
    
    // Handle accept action
    if (body.action === 'accept' && body.actionId) {
      // Create action intent (but do NOT auto-execute)
      const intent = actionIntentRepository.create({
        decisionId: id,
        actionId: body.actionId,
        notes: body.notes,
      });
      
      // Update decision status
      decisionRepository.updateStatus(id, 'accepted');
      
      return NextResponse.json({
        actionIntent: intent,
        message: 'Action intent recorded. Not auto-executing.',
      });
    }
    
    // Handle reject action
    if (body.action === 'reject') {
      decisionRepository.updateStatus(id, 'rejected');
      const updated = decisionRepository.getById(id);
      return NextResponse.json({ decision: updated });
    }
    
    return errorResponse('E_INVALID_INPUT', 'Invalid update operation');
  } catch (error) {
    console.error('Error updating decision:', error);
    return errorResponse('E_INTERNAL', 'Failed to update decision', 500);
  }
}
