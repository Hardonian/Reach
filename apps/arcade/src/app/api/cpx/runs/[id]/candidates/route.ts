import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { getCpxCandidates } from '@/lib/cpx-api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ ok: true, data: getCpxCandidates(process.cwd(), id) });
  } catch {
    return NextResponse.json({ ok: false, error: { message: 'Unable to load CPX candidates.' } }, { status: 200 });
  }
}
