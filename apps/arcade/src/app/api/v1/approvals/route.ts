import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") || "pending";
  const mine = searchParams.get("mine") === "true";

  const db = getDB();
  const conditions = ["a.tenant_id = ?", "a.status = ?"];
  const params: any[] = [ctx.tenantId, status];

  if (mine) { conditions.push("a.requested_by = ?"); params.push(ctx.userId); }

  const rows = db.prepare(`
    SELECT a.*, u.email as requester_email, r.name as role_name
    FROM approval_requests a
    LEFT JOIN users u ON a.requested_by = u.id
    LEFT JOIN roles r ON a.approver_role_id = r.id
    WHERE ${conditions.join(" AND ")} ORDER BY a.requested_at DESC
  `).all(...params) as any[];

  return NextResponse.json({ approvals: rows.map(r => ({ ...r, proposedChanges: JSON.parse(r.proposed_changes_json || '{}') })) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { resourceType, resourceId, action, proposedChanges, riskLevel, impactSummary, approverRoleId, expiresInHours = 48 } = body;
  if (!resourceType || !resourceId || !action) return cloudErrorResponse("Missing required fields", 400);

  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();

  db.prepare(`INSERT INTO approval_requests (id, tenant_id, resource_type, resource_id, action, proposed_changes_json, risk_level, impact_summary, approver_role_id, requested_by, requested_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, ctx.tenantId, resourceType, resourceId, action, JSON.stringify(proposedChanges || {}), riskLevel, impactSummary, approverRoleId, ctx.userId, now, expiresAt, now);

  auditLog(ctx, "approval_requested", "approval", id, { resourceType, resourceId, action }, req);
  return NextResponse.json({ success: true, approval: { id } }, { status: 201 });
}
