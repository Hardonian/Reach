import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse } from '@/lib/cloud-auth';
import { listAuditEvents } from '@/lib/cloud-db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);

  const events = listAuditEvents(ctx.tenantId, limit, offset);
  return NextResponse.json({ events, limit, offset });
}
