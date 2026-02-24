import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/cloud-auth';
import { authFailurePayload } from '@/lib/dgl-governance-api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return NextResponse.json(authFailurePayload(), { status: 401 });
  const { id } = await params;
  const p = path.join(process.cwd(), 'dgl', 'run-records', `${id}.json`);
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'Run not found.' } }, { status: 404 });
  return NextResponse.json({ ok: true, data: JSON.parse(fs.readFileSync(p, 'utf-8')) });
}
