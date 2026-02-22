/**
 * Junctions API Route
 * 
 * GET /api/junctions
 */

import { NextRequest, NextResponse } from 'next/server';
import { junctionRepository } from '../../../lib/db/decisions';

function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/junctions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const result = junctionRepository.list({
      type: type || undefined,
      status: status || undefined,
      since: since || undefined,
      limit,
      offset,
    });
    
    return NextResponse.json({
      junctions: result.junctions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing junctions:', error);
    return errorResponse('E_INTERNAL', 'Failed to list junctions', 500);
  }
}
