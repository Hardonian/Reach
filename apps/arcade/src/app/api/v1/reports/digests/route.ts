import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const rows = db.prepare(`
    SELECT 
      id, name, frequency, day_of_week, day_of_month, time_of_day, timezone,
      include_sections, compare_to_previous, highlight_anomalies,
      recipient_emails, is_active, last_sent_at, next_scheduled_at,
      created_by, created_at, updated_at
    FROM executive_digests
    WHERE tenant_id = ?
    ORDER BY created_at DESC
  `).all(ctx.tenantId) as any[];

  const digests = rows.map(r => ({
    id: r.id,
    name: r.name,
    frequency: r.frequency,
    schedule: {
      dayOfWeek: r.day_of_week,
      dayOfMonth: r.day_of_month,
      timeOfDay: r.time_of_day,
      timezone: r.timezone,
    },
    content: {
      sections: r.include_sections ? r.include_sections.split(",") : [],
      compareToPrevious: !!r.compare_to_previous,
      highlightAnomalies: !!r.highlight_anomalies,
    },
    recipients: r.recipient_emails ? JSON.parse(r.recipient_emails) : [],
    isActive: !!r.is_active,
    lastSentAt: r.last_sent_at,
    nextScheduledAt: r.next_scheduled_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ digests });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const {
    name,
    frequency,
    schedule = {},
    content = {},
    recipients = [],
  } = body;

  if (!name || !frequency) {
    return cloudErrorResponse("Missing required fields: name, frequency", 400);
  }

  if (!recipients.length) {
    return cloudErrorResponse("At least one recipient email is required", 400);
  }

  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const nextScheduled = calculateNextRun({
    frequency,
    dayOfWeek: schedule.dayOfWeek,
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: schedule.timeOfDay || "09:00",
    timezone: schedule.timezone || "America/New_York",
  });

  try {
    db.prepare(`
      INSERT INTO executive_digests (
        id, tenant_id, name, frequency, day_of_week, day_of_month, time_of_day, timezone,
        include_sections, compare_to_previous, highlight_anomalies,
        recipient_emails, is_active, next_scheduled_at, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ctx.tenantId,
      name,
      frequency,
      schedule.dayOfWeek || null,
      schedule.dayOfMonth || null,
      schedule.timeOfDay || "09:00",
      schedule.timezone || "America/New_York",
      (content.sections || ["summary", "gates", "signals"]).join(","),
      content.compareToPrevious ? 1 : 0,
      content.highlightAnomalies ? 1 : 0,
      JSON.stringify(recipients),
      1,
      nextScheduled,
      ctx.userId,
      now,
      now
    );

    auditLog(ctx, "digest_created", "digest", id, { name, frequency });

    return NextResponse.json({
      success: true,
      digest: {
        id,
        name,
        frequency,
        nextScheduledAt: nextScheduled,
      }
    }, { status: 201 });
  } catch (err) {
    console.error("Failed to create digest:", err);
    return cloudErrorResponse("Failed to create digest", 500);
  }
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
