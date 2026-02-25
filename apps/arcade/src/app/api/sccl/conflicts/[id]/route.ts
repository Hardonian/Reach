import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { authFailurePayload } from '@/lib/sccl-api';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    const { id } = await context.params;
    const file = path.join(process.cwd(), 'dgl', 'sccl', 'reports', `${id}.conflicts.json`);
    if (!fs.existsSync(file)) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Conflict report not found.' } }, { status: 404 });
    return NextResponse.json({ ok: true, data: JSON.parse(fs.readFileSync(file, 'utf-8')) });
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'CONFLICT_LOOKUP_FAILED', message: 'Unable to load conflict report.' } }, { status: 200 });
  }
}
