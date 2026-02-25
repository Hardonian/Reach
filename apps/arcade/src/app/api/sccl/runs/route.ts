import { NextRequest, NextResponse } from 'next/server';
import { authFailurePayload, paginate, readScclRuns } from '@/lib/sccl-api';

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('pageSize') ?? '20');
    const data = paginate(readScclRuns(process.cwd()), { page, pageSize });
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'SCCL_RUNS_FAILED', message: 'Unable to load source coherence runs.' } }, { status: 200 });
  }
}
