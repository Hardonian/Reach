import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const engine = getDemoEngine();
    const junctions = engine.getJunctions();
    
    if (junctions.length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NO_JUNCTION', message: 'Please generate junctions first' },
        schemaVersion: '1.0.0',
        engineVersion: '0.3.1-oss'
      }, { status: 400 });
    }
    
    const decision = await engine.evaluateJunction(junctions[0].id);
    const decisions = engine.getDecisions();
    const vitals = engine.getVitalsSummary();
    
    return NextResponse.json({
      ok: true,
      data: { decision, decisions, vitals },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'DECISION_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
