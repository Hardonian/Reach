import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const engine = getDemoEngine();
    const replayResult = await engine.replayEvents();
    const vitals = engine.getVitalsSummary();
    const junctions = engine.getJunctions();
    const decisions = engine.getDecisions();
    const actions = engine.getActions();
    
    return NextResponse.json({
      ok: true,
      data: { replayResult, vitals, junctions, decisions, actions },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'REPLAY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
