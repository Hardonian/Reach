/**
 * Reach Cloud — Auth middleware utilities for Next.js API routes.
 *
 * Supports:
 *   1. Session auth (cookie reach_session → web_sessions table)
 *   2. API key auth (Bearer rk_live_... → api_keys table)
 *
 * Usage in a route:
 *   const ctx = await requireAuth(req);
 *   if ('error' in ctx) return errorResponse(ctx);
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { logger } from './logger';
import {
  getSession,
  getUserById,
  lookupApiKey,
  getMembership,
  getTenant,
  appendAudit,
  CloudDisabledError,
} from './cloud-db';
import type { Tenant, User, Role } from './cloud-db';
import { redis } from './redis';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  user: User;
  tenant: Tenant;
  correlationId: string;
}

export interface ErrorContext {
  error: string;
  status: number;
  correlationId: string;
}

function correlationId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cloudErrorResponse(msg: string, status: number, corrId?: string): NextResponse {
  return NextResponse.json({
    error: msg,
    correlation_id: corrId ?? correlationId(),
  }, { status });
}

const AUTH_CACHE_TTL = 60; // seconds

async function getCachedAuth(key: string): Promise<AuthContext | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(`auth:${key}`);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function setCachedAuth(key: string, ctx: AuthContext): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`auth:${key}`, JSON.stringify(ctx), 'EX', AUTH_CACHE_TTL);
  } catch { /* ignore */ }
}

/**
 * Resolve the current user + tenant from request.
 * Checks Bearer header (API key) then session cookie.
 * Returns AuthContext or NextResponse (error).
 */
export async function resolveAuth(req: NextRequest, tenantIdOverride?: string): Promise<AuthContext | NextResponse> {
  const corrId = correlationId();

  try {
    // ── API Key Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer rk_')) {
      const rawKey = authHeader.slice(7);
      
      // Try cache first
      const cacheKey = `rk:${rawKey.slice(-12)}`; // last 12 chars for cache key (enough entropy)
      const cached = await getCachedAuth(cacheKey);
      if (cached) return { ...cached, correlationId: corrId };

      const result = lookupApiKey(rawKey);
      if (!result) {
        return cloudErrorResponse('Invalid or revoked API key', 401, corrId);
      }
      const { key, tenant } = result;
      const user = getUserById(key.user_id);
      if (!user) return cloudErrorResponse('User not found', 401, corrId);
      const membership = getMembership(tenant.id, key.user_id);
      const role: Role = membership?.role ?? 'member';
      
      const ctx: AuthContext = { userId: key.user_id, tenantId: tenant.id, role, user, tenant, correlationId: corrId };
      await setCachedAuth(cacheKey, ctx);
      return ctx;
    }

    // ── Session Auth ──────────────────────────────────────────────────────
    const cookieName = env.REACH_SESSION_COOKIE_NAME;
    const sessionId = req.cookies.get(cookieName)?.value;
    if (sessionId) {
      // Try cache first
      const cached = await getCachedAuth(`sess:${sessionId}`);
      
      // If cached tenantId matches the requested one (if any)
      if (cached && (!tenantIdOverride || cached.tenantId === tenantIdOverride)) {
        return { ...cached, correlationId: corrId };
      }

      const session = getSession(sessionId);
      if (!session) return cloudErrorResponse('Session expired or invalid', 401, corrId);
      const user = getUserById(session.user_id);
      if (!user) return cloudErrorResponse('User not found', 401, corrId);

      // Determine tenantId: from session, override param, or query
      const tenantId = tenantIdOverride ?? session.tenant_id ?? req.headers.get('x-tenant-id') ?? '';
      if (!tenantId) return cloudErrorResponse('No tenant context. Pass X-Tenant-Id header or login to a tenant.', 400, corrId);

      const tenant = getTenant(tenantId);
      if (!tenant) return cloudErrorResponse('Tenant not found', 404, corrId);

      const membership = getMembership(tenantId, user.id);
      if (!membership) return cloudErrorResponse('Not a member of this tenant', 403, corrId);

      const ctx: AuthContext = { userId: user.id, tenantId, role: membership.role, user, tenant, correlationId: corrId };
      await setCachedAuth(`sess:${sessionId}`, ctx);
      return ctx;
    }

    return cloudErrorResponse('Authentication required. Use Bearer API key or session cookie.', 401, corrId);
  } catch (err) {
    if (err instanceof CloudDisabledError) {
      return cloudErrorResponse('Cloud features are disabled (REACH_CLOUD_ENABLED not set)', 503, corrId);
    }
    logger.error('Authentication error', err, { url: req.url }, corrId);
    return cloudErrorResponse('Internal authentication error', 500, corrId);
  }
}

/** Require auth and minimum role */
export async function requireAuth(req: NextRequest, tenantIdOverride?: string): Promise<AuthContext | NextResponse> {
  return resolveAuth(req, tenantIdOverride);
}

export function requireRole(ctx: AuthContext, minRole: Role): boolean {
  const order: Role[] = ['viewer', 'member', 'admin', 'owner'];
  return order.indexOf(ctx.role) >= order.indexOf(minRole);
}

/** Standard structured error response with correlation_id */
export function errorResponse(ctx: ErrorContext): NextResponse {
  return NextResponse.json({ error: ctx.error, correlation_id: ctx.correlationId }, { status: ctx.status });
}

/** Audit-log a cloud action (no-throws) */
export function auditLog(ctx: AuthContext, action: string, resource: string, resourceId: string, meta: unknown, req: NextRequest): void {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    appendAudit(ctx.tenantId, ctx.userId, action, resource, resourceId, meta, ip);
  } catch { /* non-blocking */ }
}

/** Set session cookie on a response */
export function setSessionCookie(res: NextResponse, sessionId: string): NextResponse {
  const cookieName = env.REACH_SESSION_COOKIE_NAME;
  const ttlHours = env.REACH_SESSION_TTL_HOURS;
  res.cookies.set(cookieName, sessionId, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ttlHours * 3600,
    path: '/',
  });
  return res;
}

/** Clear session cookie */
export function clearSessionCookie(res: NextResponse): NextResponse {
  const cookieName = env.REACH_SESSION_COOKIE_NAME;
  res.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
  return res;
}
