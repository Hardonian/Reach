import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, auditLog } from '@/lib/cloud-auth';
import { createTenant, getTenantBySlug, addMember, listTenantsForUser, getEntitlement } from '@/lib/cloud-db';
import { CreateTenantSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const tenants = listTenantsForUser(ctx.userId);
  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateTenantSchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.errors.issues[0]?.message ?? 'Invalid input', 400);

  if (getTenantBySlug(parsed.data.slug)) return cloudErrorResponse('Tenant slug already taken', 409);

  const tenant = createTenant(parsed.data.name, parsed.data.slug);
  addMember(tenant.id, ctx.userId, 'owner');
  auditLog(ctx, 'tenant.create', 'tenant', tenant.id, { name: tenant.name, slug: tenant.slug }, req);
  return NextResponse.json({ tenant }, { status: 201 });
}
