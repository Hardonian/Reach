import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, auditLog } from '@/lib/cloud-auth';
import { getPack, getPackBySlug, flagPack } from '@/lib/cloud-db';
import { ReportSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const pack = getPackBySlug(id) ?? getPack(id);
  if (!pack) return cloudErrorResponse('Pack not found', 404);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(ReportSchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.errors.errors[0]?.message ?? 'Invalid input', 400);

  // Flag the pack for moderation review
  if (parsed.data.reason === 'security' || parsed.data.reason === 'malicious') {
    flagPack(pack.id);
  }
  auditLog(ctx, 'pack.report', 'pack', pack.id, { reason: parsed.data.reason, details: parsed.data.details }, req);

  return NextResponse.json({ ok: true, message: 'Report submitted. Our team will review it shortly.' });
}
