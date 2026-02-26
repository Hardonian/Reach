import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const includeUnpublished = searchParams.get("include_unpublished") === "true";

  const db = getDB();
  const conditions = includeUnpublished ? ["tenant_id IS NULL OR tenant_id = ?"] : ["(tenant_id IS NULL OR tenant_id = ?) AND is_published = 1"];
  const params: any[] = [ctx.tenantId];

  const rows = db.prepare(`SELECT * FROM changelog_entries WHERE ${conditions.join(" AND ")} ORDER BY published_at DESC, created_at DESC LIMIT 50`).all(...params) as any[];
  return NextResponse.json({ changelog: rows.map(r => ({ ...r, affectedComponents: JSON.parse(r.affected_components_json || '[]') })) });
}

// Generate changelog from reality (migrations, commits)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const now = new Date().toISOString();

  // Get recent migrations
  const migrations = db.prepare(`SELECT version, applied_at FROM schema_version WHERE applied_at > datetime('now', '-30 days') ORDER BY version DESC`).all() as any[];

  // Create draft entries from reality
  const draftId = crypto.randomUUID();
  db.prepare(`INSERT INTO changelog_drafts (id, tenant_id, title, description, detected_migrations_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`)
    .run(draftId, ctx.tenantId, `Release ${now.split('T')[0]}`, `Auto-generated from ${migrations.length} recent migrations`, JSON.stringify(migrations.map(m => m.version)), now, now);

  return NextResponse.json({ success: true, draft: { id: draftId, migrationCount: migrations.length } }, { status: 201 });
}
