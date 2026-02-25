import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authFailurePayload, listLeases, writeLeases, type LeasePayload } from '@/lib/sccl-api';

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    const body = await req.json() as { repo_id: string; branch: string; scope?: LeasePayload['scope']; paths?: string[]; ttl_seconds?: number; owner?: Partial<LeasePayload['owner']> };
    const leases = listLeases(process.cwd());
    if (leases.some((l) => l.repo_id === body.repo_id && l.branch === body.branch)) {
      return NextResponse.json({ ok: false, error: { code: 'LEASE_CONFLICT', message: 'Active lease already exists for this branch.' } }, { status: 200 });
    }
    const now = Date.now();
    const ttl = body.ttl_seconds ?? 900;
    const lease: LeasePayload = {
      lease_id: `lease_${randomUUID()}`,
      repo_id: body.repo_id,
      branch: body.branch,
      scope: body.scope ?? 'branch-level',
      paths: body.paths ?? [],
      owner: {
        user_id: body.owner?.user_id ?? 'api-user',
        device_id: body.owner?.device_id ?? 'web',
        agent_id: body.owner?.agent_id ?? 'web-agent',
      },
      acquired_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl * 1000).toISOString(),
      ttl_seconds: ttl,
    };
    writeLeases([...leases, lease], process.cwd());
    return NextResponse.json({ ok: true, data: lease });
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'LEASE_ACQUIRE_FAILED', message: 'Unable to acquire lease.' } }, { status: 200 });
  }
}
