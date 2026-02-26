import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const rows = db.prepare(`
    SELECT r.*, (SELECT COUNT(*) FROM user_role_assignments WHERE role_id = r.id) as user_count
    FROM roles r WHERE r.tenant_id = ? OR r.is_system_role = 1 ORDER BY r.is_system_role DESC, r.name
  `).all(ctx.tenantId) as any[];

  return NextResponse.json({ 
    roles: rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions_json || '[]') }))
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { name, description, permissions, resourceScopes } = body;
  if (!name || !permissions) return cloudErrorResponse("Missing required fields", 400);

  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO roles (id, tenant_id, name, description, is_system_role, is_custom, permissions_json, resource_scopes_json, created_by, created_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`)
    .run(id, ctx.tenantId, name, description, JSON.stringify(permissions), JSON.stringify(resourceScopes || {}), ctx.userId, now);

  auditLog(ctx, "role_created", "role", id, { name }, req);
  return NextResponse.json({ success: true, role: { id, name } }, { status: 201 });
}
