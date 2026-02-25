import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { getCpxRun } from '@/lib/cpx-api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
  try {
    const { id } = await params;
    const run = getCpxRun(process.cwd(), id);
    if (!run) return NextResponse.json({ ok: true, data: null }, { status: 200 });
    return NextResponse.json({ ok: true, data: run });
  } catch {
    return NextResponse.json({ ok: false, error: { message: 'Unable to load CPX run.' } }, { status: 200 });
  }
}
