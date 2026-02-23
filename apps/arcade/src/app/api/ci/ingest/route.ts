/**
 * CI Ingest — accepts artifacts from CI pipelines and stores them as ingest runs.
 *
 * Authentication: Bearer CI token with scope "ingest_runs"
 * Signature: optional X-ReadyLayer-Signature header (HMAC-SHA256 of body with key)
 *
 * POST /api/ci/ingest
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCiAuth } from "@/lib/cloud-auth";
import { createCiIngestRun, listGates, createGateRun } from "@/lib/cloud-db";
import { CiIngestSchema, parseBody } from "@/lib/cloud-schemas";
import { runGate } from "@/lib/gate-engine";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireCiAuth(req, "ingest_runs");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CiIngestSchema, body);
  if ("errors" in parsed) {
    return NextResponse.json(
      { error: parsed.errors.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ingestRun = createCiIngestRun(ctx.tenantId, {
    workspace_key: data.workspace_key,
    commit_sha: data.commit_sha,
    branch: data.branch,
    pr_number: data.pr_number,
    actor: data.actor,
    ci_provider: data.ci_provider,
    artifacts: data.artifacts as Record<string, unknown>,
    run_metadata: data.run_metadata,
  });

  let gateRunId: string | undefined;

  // If a specific gate_id is specified, trigger that gate
  if (data.gate_id) {
    try {
      const gates = listGates(ctx.tenantId);
      const targetGate = gates.find((g) => g.id === data.gate_id && g.status === "enabled");
      if (targetGate) {
        const gateRun = createGateRun(ctx.tenantId, targetGate.id, {
          trigger_type: "push",
          commit_sha: data.commit_sha,
          pr_number: data.pr_number,
          branch: data.branch,
        });
        gateRunId = gateRun.id;

        void runGate(ctx.tenantId, gateRun.id).catch((err) => {
          logger.warn("CI-triggered gate run failed", {
            gate_run_id: gateRun.id,
            err: String(err),
          });
        });
      }
    } catch (err) {
      logger.warn("Failed to trigger gate from CI ingest", {
        err: String(err),
      });
    }
  }

  return NextResponse.json(
    {
      ingest_run_id: ingestRun.id,
      gate_run_id: gateRunId ?? null,
      status: "accepted",
      report_url: gateRunId ? `/reports/${gateRunId}` : null,
      created_at: ingestRun.created_at,
    },
    { status: 202 },
  );
}
