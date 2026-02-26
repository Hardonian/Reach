import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const db = getDB();
  const rows = db.prepare(`
    SELECT step_id, status, completed_at, data_json
    FROM onboarding_state
    WHERE user_id = ? AND tenant_id = ?
  `).all(ctx.userId, ctx.tenantId) as any[];

  const steps = rows.map(r => ({
    stepId: r.step_id,
    status: r.status,
    completedAt: r.completed_at,
    data: r.data_json ? JSON.parse(r.data_json) : {},
  }));

  return NextResponse.json({ steps });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { stepId, status, data } = body;

  if (!stepId || !status) {
    return cloudErrorResponse("Missing stepId or status", 400);
  }

  const db = getDB();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO onboarding_state (user_id, tenant_id, step_id, status, completed_at, data_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tenant_id, step_id) DO UPDATE SET
      status = excluded.status,
      completed_at = excluded.completed_at,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(
    ctx.userId,
    ctx.tenantId,
    stepId,
    status,
    status === "completed" ? now : null,
    data ? JSON.stringify(data) : "{}",
    now
  );

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { steps } = body;

  if (!Array.isArray(steps)) {
    return cloudErrorResponse("Missing steps array", 400);
  }

  const db = getDB();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO onboarding_state (user_id, tenant_id, step_id, status, completed_at, data_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tenant_id, step_id) DO UPDATE SET
      status = excluded.status,
      completed_at = excluded.completed_at,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `);

  const batch = db.transaction((items) => {
    for (const item of items) {
      insert.run(
        ctx.userId,
        ctx.tenantId,
        item.stepId,
        item.status,
        item.status === "completed" ? now : null,
        item.data ? JSON.stringify(item.data) : "{}",
        now
      );
    }
  });

  batch(steps);

  return NextResponse.json({ success: true, count: steps.length });
}
