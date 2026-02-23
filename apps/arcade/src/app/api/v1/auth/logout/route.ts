import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/cloud-db";
import { clearSessionCookie } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieName = process.env.REACH_SESSION_COOKIE_NAME ?? "reach_session";
  const sessionId = req.cookies.get(cookieName)?.value;
  if (sessionId) {
    try {
      deleteSession(sessionId);
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
