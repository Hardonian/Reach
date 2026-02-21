import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { cloudErrorResponse, setSessionCookie } from '@/lib/cloud-auth';
import { logger } from '@/lib/logger';
import { recordEvent } from '@/lib/analytics-server';

export const runtime = 'nodejs';

/**
 * GitHub OAuth — Step 2: Callback handler
 *
 * GET /api/v1/auth/github/callback?code=...&state=...
 *
 * Exchanges the code for a GitHub access token, fetches the user's
 * primary email, creates/finds a local account, and sets a session.
 */

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = req.cookies.get('rl_oauth_state')?.value;
    const next = req.cookies.get('rl_oauth_next')?.value ?? '/dashboard';

    // CSRF validation
    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL('/cloud/login?error=oauth_state_mismatch', req.url));
    }

    const clientId = env.GITHUB_CLIENT_ID;
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    const redirectUrl = env.GITHUB_REDIRECT_URL;

    if (!clientId || !clientSecret || !redirectUrl) {
      return cloudErrorResponse('GitHub OAuth not configured.', 503);
    }

    // Exchange code for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUrl }),
    });

    const tokenData = await tokenRes.json() as GitHubTokenResponse;
    if (!tokenData.access_token) {
      logger.error('GitHub token exchange failed', tokenData);
      return NextResponse.redirect(new URL('/cloud/login?error=github_token_failed', req.url));
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub user
    const ghUserRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    const ghUser = await ghUserRes.json() as GitHubUser;

    // Get primary verified email
    let email = ghUser.email ?? '';
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
      });
      const emails = await emailsRes.json() as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? emails[0]?.email ?? '';
    }

    if (!email) {
      return NextResponse.redirect(new URL('/cloud/login?error=github_no_email', req.url));
    }

    // Create/find local user
    const {
      getUserByEmail, createUser, createTenant, addMember, createSession,
      getTenantBySlug, listTenantsForUser,
    } = await import('@/lib/cloud-db');

    let user = getUserByEmail(email);
    let tenantId: string;

    if (user) {
      const tenants = listTenantsForUser(user.id);
      tenantId = tenants[0]?.id ?? '';
    } else {
      // Auto-create from GitHub identity
      const displayName = ghUser.name ?? ghUser.login;
      const baseSlug = ghUser.login.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);
      const finalSlug = getTenantBySlug(baseSlug) ? `${baseSlug}-${Date.now()}` : baseSlug;

      const createdUser = createUser(email, '', displayName);
      const tenant = createTenant(displayName, finalSlug);
      addMember(tenant.id, createdUser.id, 'owner');
      user = getUserByEmail(email)!;
      tenantId = tenant.id;

      recordEvent({
        event: 'oauth_signup_completed',
        properties: { user_id: createdUser.id },
        ts: new Date().toISOString(),
      });
    }

    const session = createSession(user.id, tenantId);

    // Validate redirect target is local
    const safeNext = next.startsWith('/') ? next : '/dashboard';
    const redirectTarget = new URL(safeNext, req.url);

    const res = NextResponse.redirect(redirectTarget);

    // Clear OAuth cookies
    res.cookies.set('rl_oauth_state', '', { maxAge: 0, path: '/' });
    res.cookies.set('rl_oauth_next', '', { maxAge: 0, path: '/' });

    return setSessionCookie(res, session.id);
  } catch (err) {
    logger.error('GitHub callback error', err);
    return NextResponse.redirect(new URL('/cloud/login?error=github_callback_error', req.url));
  }
}
