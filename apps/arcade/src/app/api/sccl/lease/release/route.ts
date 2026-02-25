import { NextRequest, NextResponse } from 'next/server';
import { authFailurePayload, listLeases, writeLeases } from '@/lib/sccl-api';

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    const body = await req.json() as { lease_id: string };
    const leases = listLeases(process.cwd());
    const next = leases.filter((l) => l.lease_id !== body.lease_id);
    writeLeases(next, process.cwd());
    return NextResponse.json({ ok: next.length !== leases.length, data: { lease_id: body.lease_id } });
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'LEASE_RELEASE_FAILED', message: 'Unable to release lease.' } }, { status: 200 });
  }
}
