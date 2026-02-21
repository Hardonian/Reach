import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { cloudErrorResponse } from '@/lib/cloud-auth';
import { recordEvent } from '@/lib/analytics-server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

/**
 * GitHub OAuth — Step 1: Redirect to GitHub authorization
 *
 * GET /api/v1/auth/github
 * Redirects the browser to GitHub to authorize the app.
 *
 * Required env vars:
 *   GITHUB_CLIENT_ID
 *   GITHUB_REDIRECT_URL  (must match app setting in GitHub)
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientId = env.GITHUB_CLIENT_ID;
  const redirectUrl = env.GITHUB_REDIRECT_URL;

  if (!clientId || !redirectUrl) {
    return cloudErrorResponse('GitHub OAuth is not configured.', 503);
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Capture where to redirect after auth
  const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';

  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', clientId);
  githubUrl.searchParams.set('redirect_uri', redirectUrl);
  githubUrl.searchParams.set('scope', 'user:email');
  githubUrl.searchParams.set('state', state);

  recordEvent({
    event: 'signup_started',
    properties: { method: 'github_oauth', source: 'auth_page' },
    ts: new Date().toISOString(),
  });

  const res = NextResponse.redirect(githubUrl.toString());

  // CSRF: store state + next in short-lived cookies
  res.cookies.set('rl_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('rl_oauth_next', next.startsWith('/') ? next : '/dashboard', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return res;
}
