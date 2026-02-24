import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { authFailurePayload } from '@/lib/dgl-governance-api';
import { listViolations, type RunRecord } from '@/lib/dgl-runs-api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json(authFailurePayload(), { status: 401 });
  const { id } = await params;
  const p = path.join(process.cwd(), 'dgl', 'run-records', `${id}.json`);
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'Run not found.' } }, { status: 404 });
  const u = new URL(req.url);
  const record = JSON.parse(fs.readFileSync(p, 'utf-8')) as RunRecord;
  return NextResponse.json({ ok: true, data: listViolations(record, { page: Number(u.searchParams.get('page') ?? 1), limit: Number(u.searchParams.get('limit') ?? 20), severity: u.searchParams.get('severity') ?? '', type: u.searchParams.get('type') ?? '', subsystem: u.searchParams.get('subsystem') ?? '', pathQuery: u.searchParams.get('pathQuery') ?? '' }) });
}
