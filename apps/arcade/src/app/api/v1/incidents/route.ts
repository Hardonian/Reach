import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");

  const db = getDB();
  const conditions = ["tenant_id = ?"];
  const params: any[] = [ctx.tenantId];

  if (status) { conditions.push("status = ?"); params.push(status); }
  if (severity) { conditions.push("severity = ?"); params.push(severity); }

  const rows = db.prepare(`SELECT i.*, 
    (SELECT json_array(json_object('status', status, 'message', message, 'created_at', created_at, 'is_public', is_public)) FROM incident_updates WHERE incident_id = i.id ORDER BY created_at DESC LIMIT 5) as recent_updates
    FROM incidents i WHERE ${conditions.join(" AND ")} ORDER BY detected_at DESC`).all(...params) as any[];

  return NextResponse.json({ 
    incidents: rows.map(r => ({ ...r, affectedServices: JSON.parse(r.affected_services_json || '[]'), recentUpdates: r.recent_updates ? JSON.parse(r.recent_updates) : [] }))
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { title, description, severity, affectedServices, affectedGates, affectedSignals } = body;
  if (!title || !severity) return cloudErrorResponse("Missing required fields", 400);

  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO incidents (id, tenant_id, title, description, severity, status, affected_services_json, affected_gates_json, affected_signals_json, detected_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'detected', ?, ?, ?, ?, ?, ?)`)
    .run(id, ctx.tenantId, title, description, severity, JSON.stringify(affectedServices || []), JSON.stringify(affectedGates || []), JSON.stringify(affectedSignals || []), now, ctx.userId, now);

  auditLog(ctx, "incident_created", "incident", id, { title, severity }, req);
  return NextResponse.json({ success: true, incident: { id, title } }, { status: 201 });
}
