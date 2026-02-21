import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, auditLog } from '@/lib/cloud-auth';
import { getScenario, createScenarioRun } from '@/lib/cloud-db';
import { runSimulation } from '@/lib/simulation-runner';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const scenario = getScenario(id, ctx.tenantId);
  if (!scenario) return cloudErrorResponse('Scenario not found', 404);
  if (scenario.variants.length === 0) return cloudErrorResponse('Scenario has no variants. Add at least one variant before running.', 400);

  const scenarioRun = createScenarioRun(ctx.tenantId, id);
  auditLog(ctx, 'scenario_run.create', 'scenario_run', scenarioRun.id, { scenario_id: id }, req);

  // Execute simulation asynchronously
  void runSimulation(ctx.tenantId, scenarioRun.id).catch((err) => {
    console.error('Simulation run failed', { scenario_run_id: scenarioRun.id, err: String(err) });
  });

  return NextResponse.json({
    scenario_run: {
      id: scenarioRun.id,
      status: scenarioRun.status,
      created_at: scenarioRun.created_at,
    },
    report_url: `/reports/${scenarioRun.id}`,
    message: 'Simulation started. Poll report_url for results.',
  }, { status: 202 });
}
