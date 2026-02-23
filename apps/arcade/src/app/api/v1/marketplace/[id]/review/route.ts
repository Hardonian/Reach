import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getPack, getPackBySlug, addReview } from "@/lib/cloud-db";
import { ReviewSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const pack = getPackBySlug(id) ?? getPack(id);
  if (!pack) return cloudErrorResponse("Pack not found", 404);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(ReviewSchema, body);
  if ("errors" in parsed)
    return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid input", 400);

  addReview(pack.id, ctx.userId, parsed.data.rating, parsed.data.body);
  auditLog(ctx, "pack.review", "pack", pack.id, { rating: parsed.data.rating }, req);

  return NextResponse.json({ ok: true }, { status: 201 });
}
