import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const engine = getDemoEngine();
    const junctions = engine.getJunctions();
    const decisions = engine.getDecisions();
    const actions = engine.getActions();
    const vitals = junctions.length > 0 ? engine.getVitalsSummary() : null;
    
    return NextResponse.json({
      ok: true,
      data: {
        isSeeded: junctions.length > 0,
        junctions,
        decisions,
        actions,
        vitals
      },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'STATUS_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
