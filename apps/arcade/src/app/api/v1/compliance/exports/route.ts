import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const rows = db.prepare(`SELECT id, name, export_type, status, date_from, date_to, created_at, signed_at, verification_hash FROM compliance_exports WHERE tenant_id = ? ORDER BY created_at DESC`).all(ctx.tenantId) as any[];
  return NextResponse.json({ exports: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { name, exportType, dateFrom, dateTo, description } = body;
  if (!name || !exportType || !dateFrom || !dateTo) return cloudErrorResponse("Missing required fields", 400);

  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const verificationHash = Buffer.from(`${ctx.tenantId}:${dateFrom}:${dateTo}:${now}`).toString('base64');

  db.prepare(`INSERT INTO compliance_exports (id, tenant_id, name, description, export_type, date_from, date_to, status, verification_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'generating', ?, ?, ?)`)
    .run(id, ctx.tenantId, name, description, exportType, dateFrom, dateTo, verificationHash, ctx.userId, now);

  auditLog(ctx, "compliance_export_created", "compliance_export", id, { name, exportType }, req);
  return NextResponse.json({ success: true, export: { id, name, status: 'generating' } }, { status: 201 });
}
