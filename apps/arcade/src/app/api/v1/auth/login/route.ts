import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createSession, listTenantsForUser } from '@/lib/cloud-db';
import { verifyPassword } from '@/lib/cloud-db';
import { LoginSchema, parseBody } from '@/lib/cloud-schemas';
import { setSessionCookie, cloudErrorResponse } from '@/lib/cloud-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(LoginSchema, body);
    if ('errors' in parsed) {
      return cloudErrorResponse(parsed.errors.errors[0]?.message ?? 'Invalid input', 400);
    }
    const { email, password } = parsed.data;

    const userRow = getUserByEmail(email);
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return cloudErrorResponse('Invalid email or password', 401);
    }

    const tenants = listTenantsForUser(userRow.id);
    const defaultTenant = tenants[0];
    const session = createSession(userRow.id, defaultTenant?.id);

    const res = NextResponse.json({
      user: { id: userRow.id, email: userRow.email, display_name: userRow.display_name },
      tenant: defaultTenant ?? null,
      tenants,
    });
    return setSessionCookie(res, session.id);
  } catch (err) {
    console.error('[auth/login]', err);
    return cloudErrorResponse('Login failed', 500);
  }
}
