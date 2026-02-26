import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";
import { auditLog } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const rows = db.prepare(`
    SELECT 
      g.id, g.name, g.description, g.status, g.priority, g.config_json,
      g.owner_team, g.owner_email, g.escalation_email, g.runbook_url, g.oncall_rotation,
      g.created_at, g.updated_at,
      COUNT(DISTINCT ge.id) as evaluation_count,
      COUNT(DISTINCT CASE WHEN ge.result = 'pass' THEN ge.id END) as pass_count,
      COUNT(DISTINCT CASE WHEN ge.result = 'fail' THEN ge.id END) as fail_count
    FROM gates g
    LEFT JOIN gate_evaluations ge ON g.id = ge.gate_id
    WHERE g.tenant_id = ?
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all(ctx.tenantId) as any[];

  const gates = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    priority: r.priority,
    config: r.config_json ? JSON.parse(r.config_json) : {},
    ownership: {
      team: r.owner_team,
      owner: r.owner_email,
      escalation: r.escalation_email,
      runbook: r.runbook_url,
      oncall: r.oncall_rotation,
    },
    stats: {
      evaluations: r.evaluation_count,
      passes: r.pass_count,
      fails: r.fail_count,
      passRate: r.evaluation_count > 0 
        ? Math.round((r.pass_count / r.evaluation_count) * 100) 
        : 0,
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ gates });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { 
    name, 
    description, 
    priority = "medium", 
    config,
    ownership = {},
  } = body;

  if (!name) {
    return cloudErrorResponse("Missing required field: name", 400);
  }

  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO gates (
        id, tenant_id, name, description, status, priority, config_json,
        owner_team, owner_email, escalation_email, runbook_url, oncall_rotation,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ctx.tenantId,
      name,
      description || null,
      "active",
      priority,
      config ? JSON.stringify(config) : "{}",
      ownership.team || null,
      ownership.owner || null,
      ownership.escalation || null,
      ownership.runbook || null,
      ownership.oncall || null,
      now,
      now
    );

    auditLog(ctx, "gate_created", "gate", id, { name, priority });

    return NextResponse.json({ 
      success: true, 
      gate: {
        id,
        name,
        description,
        status: "active",
        priority,
        config: config || {},
        ownership,
        createdAt: now,
        updatedAt: now,
      }
    }, { status: 201 });
  } catch (err) {
    console.error("Failed to create gate:", err);
    return cloudErrorResponse("Failed to create gate", 500);
  }
}
