import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, auditLog } from '@/lib/cloud-auth';
import { createReportShare } from '@/lib/cloud-db';
import { CreateReportShareSchema, parseBody } from '@/lib/cloud-schemas';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateReportShareSchema, { ...body, resource_id: id });
  if ('errors' in parsed) return cloudErrorResponse(parsed.errors.issues[0]?.message ?? 'Invalid input', 400);

  const share = createReportShare(
    ctx.tenantId,
    parsed.data.resource_type,
    parsed.data.resource_id,
    parsed.data.expires_in_seconds
  );

  const baseUrl = env.READYLAYER_BASE_URL ?? 'https://app.readylayer.com';
  auditLog(ctx, 'report_share.create', 'report_share', share.id, { slug: share.slug, resource_type: share.resource_type }, req);

  return NextResponse.json({
    share_link: `${baseUrl}/reports/share/${share.slug}`,
    slug: share.slug,
    expires_at: share.expires_at,
  }, { status: 201 });
}
