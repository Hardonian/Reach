import { NextResponse } from 'next/server';
import { getDemoEngine } from '@/lib/demo-engine';

export const dynamic = 'force-dynamic';

// Store bundle in memory (in production, use proper storage)
let storedBundle: any = null;

export async function POST() {
  try {
    const engine = getDemoEngine();
    
    // First export a bundle if not exists
    if (!storedBundle) {
      storedBundle = await engine.exportBundle();
    }
    
    const verification = await engine.verifyBundle(storedBundle);
    const vitals = engine.getVitalsSummary();
    
    return NextResponse.json({
      ok: true,
      data: { verification, bundle: storedBundle, vitals },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'VERIFY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    }, { status: 500 });
  }
}
