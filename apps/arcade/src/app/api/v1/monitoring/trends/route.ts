import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const metricName = searchParams.get("metric");
  const resourceType = searchParams.get("resource_type");
  const resourceId = searchParams.get("resource_id");
  const hours = parseInt(searchParams.get("hours") || "24", 10);

  const db = getDB();
  const conditions = ["tenant_id = ?", "timestamp > datetime('now', ?)"];
  const params: any[] = [ctx.tenantId, `-${hours} hours`];

  if (metricName) { conditions.push("metric_name = ?"); params.push(metricName); }
  if (resourceType) { conditions.push("resource_type = ?"); params.push(resourceType); }
  if (resourceId) { conditions.push("resource_id = ?"); params.push(resourceId); }

  const rows = db.prepare(`
    SELECT metric_name, timestamp, value, unit, resource_type, resource_id
    FROM monitoring_trends WHERE ${conditions.join(" AND ")} ORDER BY timestamp ASC
  `).all(...params) as any[];

  const byMetric: Record<string, any[]> = {};
  rows.forEach(r => {
    if (!byMetric[r.metric_name]) byMetric[r.metric_name] = [];
    byMetric[r.metric_name].push({ t: r.timestamp, v: r.value, u: r.unit });
  });

  return NextResponse.json({ trends: byMetric, count: rows.length });
}
