import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const alertId = searchParams.get("alert_id");
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const failedOnly = searchParams.get("failed_only") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const db = getDB();
  const conditions: string[] = ["d.tenant_id = ?"];
  const params: any[] = [ctx.tenantId];

  if (alertId) {
    conditions.push("d.alert_id = ?");
    params.push(alertId);
  }
  if (channel) {
    conditions.push("d.channel = ?");
    params.push(channel);
  }
  if (status) {
    conditions.push("d.status = ?");
    params.push(status);
  }
  if (failedOnly) {
    conditions.push("d.status IN ('failed', 'bounced')");
  }

  const whereClause = conditions.join(" AND ");

  const rows = db.prepare(`
    SELECT 
      d.id, d.alert_id, d.channel, d.recipient, d.status,
      d.retry_count, d.max_retries, d.next_retry_at,
      d.error_code, d.error_message, d.error_category,
      d.escalation_triggered, d.attempted_at, d.completed_at,
      a.title as alert_title, a.severity as alert_severity
    FROM alert_delivery_log d
    LEFT JOIN alerts a ON d.alert_id = a.id
    WHERE ${whereClause}
    ORDER BY d.attempted_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const [{ count }] = db.prepare(`
    SELECT COUNT(*) as count FROM alert_delivery_log d WHERE ${whereClause}
  `).all(...params) as any[];

  const deliveries = rows.map(r => ({
    id: r.id,
    alertId: r.alert_id,
    alertTitle: r.alert_title,
    alertSeverity: r.alert_severity,
    channel: r.channel,
    recipient: r.recipient,
    status: r.status,
    retryCount: r.retry_count,
    maxRetries: r.max_retries,
    nextRetryAt: r.next_retry_at,
    error: r.error_code ? {
      code: r.error_code,
      message: r.error_message,
      category: r.error_category,
    } : null,
    escalationTriggered: !!r.escalation_triggered,
    attemptedAt: r.attempted_at,
    completedAt: r.completed_at,
  }));

  return NextResponse.json({ 
    deliveries, 
    total: count, 
    limit, 
    offset,
    hasMore: offset + deliveries.length < count 
  });
}

// Retry a failed delivery
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { deliveryId } = body;

  if (!deliveryId) {
    return cloudErrorResponse("Missing deliveryId", 400);
  }

  const db = getDB();
  const delivery = db.prepare(`
    SELECT * FROM alert_delivery_log 
    WHERE id = ? AND tenant_id = ?
  `).get(deliveryId, ctx.tenantId) as any;

  if (!delivery) {
    return cloudErrorResponse("Delivery not found", 404);
  }

  if (delivery.status !== "failed" && delivery.status !== "bounced") {
    return cloudErrorResponse("Can only retry failed or bounced deliveries", 400);
  }

  if (delivery.retry_count >= delivery.max_retries) {
    return cloudErrorResponse("Max retries exceeded", 400);
  }

  const now = new Date().toISOString();
  
  // Reset for retry
  db.prepare(`
    UPDATE alert_delivery_log
    SET status = 'pending',
        retry_count = retry_count + 1,
        attempted_at = ?,
        completed_at = NULL,
        error_code = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, deliveryId);

  // In production, this would enqueue a job to actually send
  // For now, we return success and the UI can poll for status

  return NextResponse.json({ 
    success: true, 
    message: "Delivery queued for retry",
    deliveryId,
    retryCount: delivery.retry_count + 1
  });
}
