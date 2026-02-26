import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";
import { listAuditEvents, countAuditEvents, type AuditFilter } from "@/lib/db/ops";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Build filter from query params
  const filter: AuditFilter = {
    action: searchParams.get("action") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    actor: searchParams.get("actor") ?? undefined,
    fromDate: searchParams.get("from") ?? undefined,
    toDate: searchParams.get("to") ?? undefined,
    searchQuery: searchParams.get("q") ?? undefined,
  };

  // Clean up undefined values
  Object.keys(filter).forEach((key) => {
    if (filter[key as keyof AuditFilter] === undefined) {
      delete filter[key as keyof AuditFilter];
    }
  });

  const events = listAuditEvents(ctx.tenantId, limit, offset, filter);
  const total = countAuditEvents(ctx.tenantId, filter);

  return NextResponse.json({ events, limit, offset, total });
}
