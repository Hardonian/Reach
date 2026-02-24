import { NextRequest, NextResponse } from 'next/server';
import { runReachCli } from '@/lib/cli-adapter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'verify') {
      const result = await runReachCli('verify-determinism', ['--n', '2']);
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'replay') {
      const runId = typeof body?.runId === 'string' ? body.runId : '';
      if (!runId) {
        return NextResponse.json({ ok: false, mode: 'static', summary: 'Missing runId for replay.' }, { status: 400 });
      }
      const result = await runReachCli('replay', [runId]);
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ ok: false, mode: 'static', summary: 'Unsupported evidence action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'static',
        summary: 'Failed to execute evidence action.',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      },
      { status: 200 }
    );
  }
}
