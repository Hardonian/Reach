import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const resourceType = searchParams.get("resource_type");
  const resourceId = searchParams.get("resource_id");

  const db = getDB();
  const conditions = ["tenant_id = ?"];
  const params: any[] = [ctx.tenantId];

  if (resourceType) { conditions.push("resource_type = ?"); params.push(resourceType); }
  if (resourceId) { conditions.push("resource_id = ?"); params.push(resourceId); }

  const rows = db.prepare(`
    SELECT s.*,
      (SELECT json_object('actual_value', actual_value, 'error_budget_remaining', error_budget_remaining, 
        'error_budget_burn_rate', error_budget_burn_rate, 'is_breaching', is_breaching)
       FROM slo_measurements WHERE slo_id = s.id ORDER BY period_start DESC LIMIT 1) as latest
    FROM slo_definitions s WHERE ${conditions.join(" AND ")} AND is_active = 1 ORDER BY s.created_at DESC
  `).all(...params) as any[];

  return NextResponse.json({ 
    slos: rows.map(r => ({ ...r, latestMeasurement: r.latest ? JSON.parse(r.latest) : null }))
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { name, description, resourceType, resourceId, metricType, targetValue, targetUnit, windowDays = 30 } = body;
  if (!name || !resourceType || !metricType || targetValue === undefined) {
    return cloudErrorResponse("Missing required fields", 400);
  }

  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO slo_definitions (id, tenant_id, name, description, resource_type, resource_id, metric_type, target_value, target_unit, window_days, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, ctx.tenantId, name, description, resourceType, resourceId, metricType, targetValue, targetUnit || "%", windowDays, ctx.userId, now);

  auditLog(ctx, "slo_created", "slo", id, { name }, req);
  return NextResponse.json({ success: true, slo: { id, name } }, { status: 201 });
}
