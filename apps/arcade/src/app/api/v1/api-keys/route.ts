import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from '@/lib/cloud-auth';
import { createApiKey, listApiKeys } from '@/lib/cloud-db';
import { CreateApiKeySchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const keys = listApiKeys(ctx.tenantId).map((k) => ({
    id: k.id, name: k.name, key_prefix: k.key_prefix,
    scopes: k.scopes, created_at: k.created_at, last_used_at: k.last_used_at, expires_at: k.expires_at,
  }));
  return NextResponse.json({ api_keys: keys });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, 'admin')) return cloudErrorResponse('Insufficient permissions', 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateApiKeySchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.firstMessage, 400);

  const { key, rawKey } = createApiKey(ctx.tenantId, ctx.userId, parsed.data.name, parsed.data.scopes);
  auditLog(ctx, 'api_key.create', 'api_key', key.id, { name: key.name }, req);
  return NextResponse.json({
    api_key: {
      id: key.id, name: key.name, key_prefix: key.key_prefix,
      scopes: key.scopes, created_at: key.created_at,
    },
    raw_key: rawKey, // shown once
  }, { status: 201 });
}
