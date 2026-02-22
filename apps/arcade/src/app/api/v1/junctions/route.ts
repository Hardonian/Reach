import { NextRequest, NextResponse } from 'next/server';
import { JunctionRepository } from '@/lib/db/junctions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const junctionType = searchParams.get('junctionType');
    const sourceType = searchParams.get('sourceType');
    const status = searchParams.get('status');
    const minSeverity = searchParams.get('minSeverity');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const junctions = JunctionRepository.list({
      junctionType: junctionType || undefined,
      sourceType: sourceType || undefined,
      status: status || undefined,
      minSeverity: minSeverity ? parseFloat(minSeverity) : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: junctions,
      meta: {
        count: junctions.length,
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
