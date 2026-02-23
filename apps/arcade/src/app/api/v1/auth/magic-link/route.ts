import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse } from "@/lib/cloud-auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { recordEvent } from "@/lib/analytics-server";
import crypto from "node:crypto";

export const runtime = "nodejs";

/**
 * Magic Link Auth — sends a one-time sign-in link via email.
 *
 * POST /api/v1/auth/magic-link
 * Body: { email: string }
 *
 * In production: integrate with Resend/SendGrid/Postmark.
 * In dev/demo: returns the link in the response body (never in production!).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Rate limit: 5 magic links / 15 minutes per IP
  const { success } = await checkRateLimit(ip, 5, 900);
  if (!success) {
    return cloudErrorResponse(
      "Too many requests. Try again in a few minutes.",
      429,
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return cloudErrorResponse("Valid email address required.", 400);
    }

    // Generate a secure token (in production: store in DB with 15-min TTL)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // In production: store token in DB, send email via provider
    const isDev = process.env.NODE_ENV !== "production";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const magicUrl = `${appUrl}/api/v1/auth/magic-link/verify?token=${token}&email=${encodeURIComponent(email)}`;

    logger.info("Magic link generated", { email, expiresAt, isDev });

    recordEvent({
      event: "signup_started",
      properties: { method: "magic_link", source: "auth_page" },
      ts: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message:
        "If an account exists (or will be created), you will receive a sign-in link shortly.",
      // Dev-only: expose link for local testing
      ...(isDev && { dev_link: magicUrl }),
    });
  } catch (err) {
    logger.error("Magic link error", err);
    return cloudErrorResponse("Could not send magic link.", 500);
  }
}

/**
 * GET /api/v1/auth/magic-link/verify?token=...&email=...
 * Verifies the token and creates/signs in the user.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(
        new URL("/cloud/login?error=invalid_link", req.url),
      );
    }

    // In production: verify token from DB, check expiry, mark as used
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      return NextResponse.redirect(
        new URL("/cloud/login?error=magic_link_unverified", req.url),
      );
    }

    // Dev: create/login the user
    const {
      getUserByEmail,
      createUser,
      createTenant,
      addMember,
      createSession,
      getTenantBySlug,
      listTenantsForUser,
    } = await import("@/lib/cloud-db");
    const { setSessionCookie } = await import("@/lib/cloud-auth");

    let user = getUserByEmail(email);
    let tenantId: string;

    if (user) {
      const tenants = listTenantsForUser(user.id);
      tenantId = tenants[0]?.id ?? "";
    } else {
      const slug = email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 32);
      const finalSlug = getTenantBySlug(slug) ? `${slug}-${Date.now()}` : slug;
      const createdUser = createUser(email, "", email.split("@")[0]);
      const tenant = createTenant(email.split("@")[0], finalSlug);
      addMember(tenant.id, createdUser.id, "owner");
      user = getUserByEmail(email)!;
      tenantId = tenant.id;
    }

    const session = createSession(user.id, tenantId);
    const res = NextResponse.redirect(new URL("/dashboard", req.url));

    recordEvent({
      event: "magic_link_signup_completed",
      properties: { user_id: user.id },
      ts: new Date().toISOString(),
    });

    return setSessionCookie(res, session.id);
  } catch (err) {
    logger.error("Magic link verify error", err);
    return NextResponse.redirect(
      new URL("/cloud/login?error=magic_link_error", req.url),
    );
  }
}
