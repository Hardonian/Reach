import { NextRequest, NextResponse } from 'next/server';
import { getStatus } from '@/lib/sccl-server';
import { authFailurePayload } from '@/lib/sccl-api';

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    return NextResponse.json({ ok: true, data: getStatus(process.cwd()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: 'SCCL_STATUS_ERROR', message: 'Unable to load source coherence status.', details: error instanceof Error ? error.message : 'unknown' } }, { status: 200 });
  }
}
