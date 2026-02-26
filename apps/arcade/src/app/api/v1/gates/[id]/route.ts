import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const db = getDB();

  const row = db.prepare(`
    SELECT 
      g.id, g.name, g.description, g.status, g.priority, g.config_json,
      g.owner_team, g.owner_email, g.escalation_email, g.runbook_url, g.oncall_rotation,
      g.created_at, g.updated_at
    FROM gates g
    WHERE g.id = ? AND g.tenant_id = ?
  `).get(id, ctx.tenantId) as any;

  if (!row) {
    return cloudErrorResponse("Gate not found", 404);
  }

  return NextResponse.json({
    gate: {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      config: row.config_json ? JSON.parse(row.config_json) : {},
      ownership: {
        team: row.owner_team,
        owner: row.owner_email,
        escalation: row.escalation_email,
        runbook: row.runbook_url,
        oncall: row.oncall_rotation,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { 
    name, 
    description, 
    status, 
    priority, 
    config,
    ownership,
  } = body;

  const db = getDB();
  const now = new Date().toISOString();

  // Get current gate for version tracking
  const current = db.prepare(`
    SELECT config_json FROM gates WHERE id = ? AND tenant_id = ?
  `).get(id, ctx.tenantId) as any;

  if (!current) {
    return cloudErrorResponse("Gate not found", 404);
  }

  // Build update fields dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (priority !== undefined) { updates.push("priority = ?"); values.push(priority); }
  if (config !== undefined) { updates.push("config_json = ?"); values.push(JSON.stringify(config)); }
  if (ownership?.team !== undefined) { updates.push("owner_team = ?"); values.push(ownership.team); }
  if (ownership?.owner !== undefined) { updates.push("owner_email = ?"); values.push(ownership.owner); }
  if (ownership?.escalation !== undefined) { updates.push("escalation_email = ?"); values.push(ownership.escalation); }
  if (ownership?.runbook !== undefined) { updates.push("runbook_url = ?"); values.push(ownership.runbook); }
  if (ownership?.oncall !== undefined) { updates.push("oncall_rotation = ?"); values.push(ownership.oncall); }

  updates.push("updated_at = ?");
  values.push(now);
  values.push(id);
  values.push(ctx.tenantId);

  try {
    // Create version snapshot if config changed
    if (config !== undefined) {
      const currentConfigHash = db.prepare(`
        SELECT hex(md5(config_json)) as hash FROM gates WHERE id = ?
      `).get(id) as any;

      const newConfigHash = db.prepare(`SELECT hex(md5(?)) as hash`, config ? JSON.stringify(config) : "{}").get() as any;

      if (currentConfigHash?.hash !== newConfigHash?.hash) {
        const versionNum = db.prepare(`
          SELECT COALESCE(MAX(version_number), 0) + 1 as next_version 
          FROM gate_versions WHERE gate_id = ?
        `).get(id) as any;

        db.prepare(`
          INSERT INTO gate_versions (gate_id, tenant_id, version_number, config_json, config_hash, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          ctx.tenantId,
          versionNum.next_version,
          current.config_json,
          currentConfigHash?.hash || "",
          ctx.userId,
          now
        );
      }
    }

    db.prepare(`
      UPDATE gates SET ${updates.join(", ")} 
      WHERE id = ? AND tenant_id = ?
    `).run(...values);

    auditLog(ctx, "gate_updated", "gate", id, { 
      fields: Object.keys(body),
      ownership: ownership ? Object.keys(ownership) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update gate:", err);
    return cloudErrorResponse("Failed to update gate", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const db = getDB();

  const result = db.prepare(`
    DELETE FROM gates WHERE id = ? AND tenant_id = ?
  `).run(id, ctx.tenantId);

  if (result.changes === 0) {
    return cloudErrorResponse("Gate not found", 404);
  }

  auditLog(ctx, "gate_deleted", "gate", id, {});

  return NextResponse.json({ success: true });
}
