import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { listCpxRuns } from '@/lib/cpx-api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');
    return NextResponse.json({ ok: true, data: listCpxRuns(process.cwd(), page, limit) });
  } catch {
    return NextResponse.json({ ok: false, error: { message: 'Unable to list CPX runs.' } }, { status: 200 });
  }
}
