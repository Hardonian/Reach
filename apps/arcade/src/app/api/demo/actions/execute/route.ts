import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const engine = getDemoEngine();
    const actions = engine.getActions();
    
    if (actions.length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'NO_ACTION', message: 'Please plan an action first' },
        schemaVersion: '1.0.0',
        engineVersion: '0.3.1-oss'
      }, { status: 400 });
    }
    
    const execution = await engine.executeAction(actions[0].id);
    const vitals = engine.getVitalsSummary();
    
    return NextResponse.json({
      ok: true,
      data: { execution, actions: engine.getActions(), vitals },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'EXECUTE_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
