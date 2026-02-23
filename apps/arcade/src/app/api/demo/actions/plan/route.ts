import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const engine = getDemoEngine();
    const decisions = engine.getDecisions();
    
    if (decisions.length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NO_DECISION', message: 'Please evaluate a decision first' },
        schemaVersion: '1.0.0',
        engineVersion: '0.3.1-oss'
      }, { status: 400 });
    }
    
    const actionPlan = await engine.planAction(decisions[0].id);
    const actions = engine.getActions();
    const vitals = engine.getVitalsSummary();
    
    return NextResponse.json({
      ok: true,
      data: { actionPlan, actions, vitals },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'PLAN_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
