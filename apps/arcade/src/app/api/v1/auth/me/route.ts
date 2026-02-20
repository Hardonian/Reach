import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse } from '@/lib/cloud-auth';
import { listTenantsForUser, listApiKeys } from '@/lib/cloud-db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const tenants = listTenantsForUser(ctx.userId);
    const keys = listApiKeys(ctx.tenantId).map((k) => ({
      id: k.id, name: k.name, key_prefix: k.key_prefix,
      scopes: k.scopes, created_at: k.created_at, last_used_at: k.last_used_at,
    }));
    return NextResponse.json({
      user: { id: ctx.user.id, email: ctx.user.email, display_name: ctx.user.display_name },
      tenant: ctx.tenant,
      tenants,
      role: ctx.role,
      api_keys: keys,
    });
  } catch (err) {
    logger.error('Failed to fetch user info', err);
    return cloudErrorResponse('Failed to fetch user info', 500);
  }
}
