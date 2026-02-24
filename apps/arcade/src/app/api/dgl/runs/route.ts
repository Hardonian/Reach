import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { authFailurePayload } from '@/lib/dgl-governance-api';
import { listRuns, type RunRecord } from '@/lib/dgl-runs-api';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json(authFailurePayload(), { status: 401 });
  const dir = path.join(process.cwd(), 'dgl', 'run-records');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const records = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as RunRecord);
  const u = new URL(req.url);
  return NextResponse.json({ ok: true, data: listRuns(records, { page: Number(u.searchParams.get('page') ?? 1), limit: Number(u.searchParams.get('limit') ?? 20), branch: u.searchParams.get('branch') ?? '', provider: u.searchParams.get('provider') ?? '' }) });
}
