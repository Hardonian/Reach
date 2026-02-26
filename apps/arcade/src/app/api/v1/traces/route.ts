import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";
import { getDB } from "@/lib/db/connection";

export const runtime = "nodejs";

export interface Trace {
  id: string;
  run_id: string;
  workflow_id?: string;
  gate_id?: string;
  trace_type: "workflow" | "gate" | "tool" | "agent";
  status: "running" | "completed" | "failed" | "cancelled";
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  steps: TraceStep[];
  metadata: {
    agent_name?: string;
    tool_name?: string;
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
}

export interface TraceStep {
  id: string;
  step_number: number;
  name: string;
  type: "llm" | "tool" | "decision" | "gate" | "error";
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  input?: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const runId = searchParams.get("run_id");
  const workflowId = searchParams.get("workflow_id");
  const gateId = searchParams.get("gate_id");
  const status = searchParams.get("status");
  const traceType = searchParams.get("type");
  const search = searchParams.get("search");

  const db = getDB();
  
  // Build query dynamically
  let whereClause = "WHERE t.tenant_id = ?";
  const params: (string | number)[] = [ctx.tenantId];

  if (runId) {
    whereClause += " AND t.run_id = ?";
    params.push(runId);
  }
  if (workflowId) {
    whereClause += " AND t.workflow_id = ?";
    params.push(workflowId);
  }
  if (gateId) {
    whereClause += " AND t.gate_id = ?";
    params.push(gateId);
  }
  if (status) {
    whereClause += " AND t.status = ?";
    params.push(status);
  }
  if (traceType) {
    whereClause += " AND t.trace_type = ?";
    params.push(traceType);
  }
  if (search) {
    whereClause += " AND (t.run_id LIKE ? OR w.name LIKE ? OR g.name LIKE ?)";
    const likeSearch = `%${search}%`;
    params.push(likeSearch, likeSearch, likeSearch);
  }

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as count 
    FROM traces t
    LEFT JOIN workflows w ON t.workflow_id = w.id
    LEFT JOIN gates g ON t.gate_id = g.id
    ${whereClause}
  `).get(...params) as { count: number };

  // Get traces with joins for names
  const traces = db.prepare(`
    SELECT 
      t.*,
      w.name as workflow_name,
      g.name as gate_name
    FROM traces t
    LEFT JOIN workflows w ON t.workflow_id = w.id
    LEFT JOIN gates g ON t.gate_id = g.id
    ${whereClause}
    ORDER BY t.started_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  // Fetch steps for each trace
  const tracesWithSteps = traces.map(trace => {
    const steps = db.prepare(`
      SELECT * FROM trace_steps 
      WHERE trace_id = ? 
      ORDER BY step_number ASC
    `).all(trace.id) as TraceStep[];

    return {
      id: trace.id,
      run_id: trace.run_id,
      workflow_id: trace.workflow_id,
      workflow_name: trace.workflow_name,
      gate_id: trace.gate_id,
      gate_name: trace.gate_name,
      trace_type: trace.trace_type,
      status: trace.status,
      started_at: trace.started_at,
      finished_at: trace.finished_at,
      duration_ms: trace.finished_at 
        ? new Date(trace.finished_at).getTime() - new Date(trace.started_at).getTime()
        : undefined,
      steps: steps.map(s => ({
        ...s,
        metadata: s.metadata ? JSON.parse(s.metadata as unknown as string) : undefined,
      })),
      metadata: {
        agent_name: trace.agent_name,
        tool_name: trace.tool_name,
        input_tokens: trace.input_tokens,
        output_tokens: trace.output_tokens,
        cost_usd: trace.cost_usd,
      },
    };
  });

  return NextResponse.json({
    traces: tracesWithSteps,
    total: countResult.count,
    limit,
    offset,
  });
}
