import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const engine = getDemoEngine();
    const bundle = await engine.exportBundle();
    const vitals = engine.getVitalsSummary();
    
    return NextResponse.json({
      ok: true,
      data: { bundle, vitals },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'EXPORT_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
