import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const db = getDB();

  const digest = db.prepare(`
    SELECT * FROM executive_digests 
    WHERE id = ? AND tenant_id = ? AND is_active = 1
  `).get(id, ctx.tenantId) as any;

  if (!digest) {
    return cloudErrorResponse("Digest not found or inactive", 404);
  }

  const now = new Date().toISOString();
  const executionId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO digest_executions (
      id, digest_id, tenant_id, status, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(executionId, id, ctx.tenantId, "generating", now);

  try {
    const sections = digest.include_sections ? digest.include_sections.split(",") : [];
    const summary: Record<string, any> = {};

    if (sections.includes("summary")) {
      summary.overview = await generateOverviewMetrics(db, ctx.tenantId);
    }
    if (sections.includes("gates")) {
      summary.gates = await generateGateMetrics(db, ctx.tenantId);
    }
    if (sections.includes("signals")) {
      summary.signals = await generateSignalMetrics(db, ctx.tenantId);
    }
    if (sections.includes("audit")) {
      summary.audit = await generateAuditSummary(db, ctx.tenantId);
    }
    if (digest.compare_to_previous) {
      summary.comparison = await generateComparison(db, ctx.tenantId, sections);
    }
    if (digest.highlight_anomalies) {
      summary.anomalies = await detectAnomalies(db, ctx.tenantId);
    }

    db.prepare(`
      UPDATE digest_executions 
      SET status = 'sent', 
          generated_at = ?, 
          sent_at = ?, 
          summary_json = ?,
          recipient_count = ?
      WHERE id = ?
    `).run(
      now,
      now,
      JSON.stringify(summary),
      JSON.parse(digest.recipient_emails || "[]").length,
      executionId
    );

    const nextScheduled = calculateNextRun({
      frequency: digest.frequency,
      dayOfWeek: digest.day_of_week,
      dayOfMonth: digest.day_of_month,
      timeOfDay: digest.time_of_day,
      timezone: digest.timezone,
    });

    db.prepare(`
      UPDATE executive_digests 
      SET last_sent_at = ?, next_scheduled_at = ?
      WHERE id = ?
    `).run(now, nextScheduled, id);

    auditLog(ctx, "digest_generated", "digest", id, { executionId }, req);

    return NextResponse.json({
      success: true,
      executionId,
      summary,
      recipients: JSON.parse(digest.recipient_emails || "[]"),
    });

  } catch (err) {
    console.error("Failed to generate digest:", err);
    
    db.prepare(`
      UPDATE digest_executions 
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `).run(String(err), executionId);

    return cloudErrorResponse("Failed to generate digest", 500);
  }
}

async function generateOverviewMetrics(db: any, tenantId: string) {
  const gateStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive
    FROM gates WHERE tenant_id = ?
  `).get(tenantId);

  const signalStats = db.prepare(`
    SELECT COUNT(*) as total FROM signals WHERE tenant_id = ?
  `).get(tenantId);

  const runStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
    FROM workflow_runs 
    WHERE tenant_id = ? AND started_at > datetime('now', '-7 days')
  `).get(tenantId);

  return { gates: gateStats, signals: signalStats, runsLast7Days: runStats };
}

async function generateGateMetrics(db: any, tenantId: string) {
  const evaluations = db.prepare(`
    SELECT 
      g.name,
      COUNT(ge.id) as eval_count,
      COUNT(CASE WHEN ge.result = 'pass' THEN 1 END) as passes,
      COUNT(CASE WHEN ge.result = 'fail' THEN 1 END) as fails
    FROM gates g
    LEFT JOIN gate_evaluations ge ON g.id = ge.gate_id
      AND ge.created_at > datetime('now', '-7 days')
    WHERE g.tenant_id = ?
    GROUP BY g.id
    ORDER BY eval_count DESC
    LIMIT 10
  `).all(tenantId);

  return { topGates: evaluations };
}

async function generateSignalMetrics(db: any, tenantId: string) {
  const signals = db.prepare(`
    SELECT name, COUNT(*) as fire_count
    FROM signals s
    JOIN signal_fires sf ON s.id = sf.signal_id
    WHERE s.tenant_id = ? AND sf.created_at > datetime('now', '-7 days')
    GROUP BY s.id
    ORDER BY fire_count DESC
    LIMIT 10
  `).all(tenantId);

  return { topSignals: signals };
}

async function generateAuditSummary(db: any, tenantId: string) {
  const events = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_log
    WHERE tenant_id = ? AND created_at > datetime('now', '-7 days')
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `).all(tenantId);

  return { topActions: events };
}

async function generateComparison(db: any, tenantId: string, sections: string[]) {
  const runComparison = db.prepare(`
    SELECT 
      SUM(CASE WHEN started_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as current_week,
      SUM(CASE WHEN started_at > datetime('now', '-14 days') AND started_at <= datetime('now', '-7 days') THEN 1 ELSE 0 END) as previous_week
    FROM workflow_runs
    WHERE tenant_id = ?
  `).get(tenantId);

  return {
    runVolume: {
      current: runComparison.current_week,
      previous: runComparison.previous_week,
      change: runComparison.previous_week > 0 
        ? Math.round(((runComparison.current_week - runComparison.previous_week) / runComparison.previous_week) * 100)
        : 0,
    }
  };
}

async function detectAnomalies(db: any, tenantId: string) {
  const anomalies: any[] = [];

  const failSpike = db.prepare(`
    SELECT COUNT(*) as count
    FROM workflow_runs
    WHERE tenant_id = ? AND status = 'failed' AND started_at > datetime('now', '-24 hours')
  `).get(tenantId);

  if (failSpike.count > 10) {
    anomalies.push({
      type: "high_failure_rate",
      severity: "warning",
      message: `${failSpike.count} failed runs in last 24 hours`,
    });
  }

  return anomalies;
}

function calculateNextRun(schedule: {
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
}): string {
  const now = new Date();
  const [hours, minutes] = schedule.timeOfDay.split(":").map(Number);
  
  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (schedule.frequency) {
    case "daily":
      break;
    case "weekly":
      const targetDay = schedule.dayOfWeek ?? 1;
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case "monthly":
      const targetDate = schedule.dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }

  return next.toISOString();
}
