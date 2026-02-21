import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from '@/lib/cloud-auth';
import { getWorkflow, createWorkflowRun, listWorkflowRuns, updateWorkflowRun, checkRunLimit, incrementRunUsage } from '@/lib/cloud-db';
import { RunWorkflowSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!getWorkflow(id, ctx.tenantId)) return cloudErrorResponse('Workflow not found', 404);
  const runs = listWorkflowRuns(ctx.tenantId, id);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, 'member')) return cloudErrorResponse('Insufficient permissions', 403);

  const { id } = await params;
  const wf = getWorkflow(id, ctx.tenantId);
  if (!wf) return cloudErrorResponse('Workflow not found', 404);

  // Entitlement check
  const limits = checkRunLimit(ctx.tenantId);
  if (!limits.allowed) {
    return cloudErrorResponse(
      `Run limit reached. Used ${limits.used}/${limits.limit} runs this month on the ${limits.plan} plan. Upgrade to continue.`,
      429
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(RunWorkflowSchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.errors.issues[0]?.message ?? 'Invalid input', 400);

  const run = createWorkflowRun(ctx.tenantId, id, parsed.data.inputs);
  incrementRunUsage(ctx.tenantId);
  auditLog(ctx, 'workflow_run.create', 'workflow_run', run.id, { workflow_id: id }, req);

  // Simulate async execution (real wiring would call Go runner)
  simulateExecution(run.id, ctx.tenantId, wf, parsed.data.inputs);

  return NextResponse.json({ run }, { status: 202 });
}

// ── Simulated execution (wires to Go runner in real deployment) ───────────
async function simulateExecution(runId: string, tenantId: string, wf: { id: string; name: string; graph_json: string }, inputs: unknown) {
  const startedAt = new Date().toISOString();
  updateWorkflowRun(runId, tenantId, { status: 'running', started_at: startedAt });

  const graph = JSON.parse(wf.graph_json);
  const nodeCount = graph.nodes?.length ?? 0;
  const delay = Math.min(500 + nodeCount * 200, 3000);

  await new Promise((r) => setTimeout(r, delay));

  // Attempt to call real Go runner if available
  const runnerUrl = process.env.REACH_RUNNER_URL ?? 'http://localhost:8080';
  try {
    const resp = await fetch(`${runnerUrl}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      body: JSON.stringify({ capabilities: graph.nodes?.map((n: { type: string }) => n.type) ?? [], inputs }),
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json() as { run_id?: string };
      updateWorkflowRun(runId, tenantId, {
        status: 'completed',
        outputs_json: JSON.stringify({ runner_run_id: data.run_id, workflow_name: wf.name }),
        metrics_json: JSON.stringify({ nodes_executed: nodeCount, duration_ms: delay }),
        finished_at: new Date().toISOString(),
      });
      return;
    }
  } catch { /* runner not available, use simulation */ }

  updateWorkflowRun(runId, tenantId, {
    status: 'completed',
    outputs_json: JSON.stringify({ simulated: true, workflow_name: wf.name, inputs }),
    metrics_json: JSON.stringify({ nodes_executed: nodeCount, duration_ms: delay }),
    finished_at: new Date().toISOString(),
  });
}
