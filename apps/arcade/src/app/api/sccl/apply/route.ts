import { NextRequest, NextResponse } from 'next/server';
import { applyPack } from '@/lib/sccl-server';
import { authFailurePayload } from '@/lib/sccl-api';

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get('x-reach-auth')) return NextResponse.json(authFailurePayload(), { status: 401 });
    const body = await req.json() as { pack: { pack_id: string; base_sha: string; files: Array<{ path: string; patch: string }>; actor: Record<string, unknown>; context_hash?: string }; branch?: string };
    const data = applyPack(body.pack, body.branch ?? 'web-agent', process.cwd());
    return NextResponse.json({ ok: data.result.ok, data: { ...data, mode: 'web-agent-plan-supported' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: 'APPLY_FAILED', message: error instanceof Error ? error.message : 'Unable to process patch pack.' } }, { status: 200 });
  }
}
