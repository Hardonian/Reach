import { NextRequest, NextResponse } from 'next/server';
import { createUser, createTenant, addMember, createSession, getTenantBySlug, getUserByEmail } from '@/lib/cloud-db';
import { RegisterSchema, parseBody } from '@/lib/cloud-schemas';
import { setSessionCookie, cloudErrorResponse } from '@/lib/cloud-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(RegisterSchema, body);
    if ('errors' in parsed) {
      return cloudErrorResponse(parsed.firstMessage, 400);
    }
    const { email, password, displayName, tenantName, tenantSlug } = parsed.data;

    if (getUserByEmail(email)) {
      return cloudErrorResponse('Email already registered', 409);
    }
    if (getTenantBySlug(tenantSlug)) {
      return cloudErrorResponse('Tenant slug already taken', 409);
    }

    const user = createUser(email, password, displayName);
    const tenant = createTenant(tenantName, tenantSlug);
    addMember(tenant.id, user.id, 'owner');
    const session = createSession(user.id, tenant.id);

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      tenant,
    }, { status: 201 });
    return setSessionCookie(res, session.id);
  } catch (err) {
    console.error('[auth/register]', err);
    return cloudErrorResponse('Registration failed', 500);
  }
}
