/**
 * GitHub Webhook Receiver
 *
 * Validates HMAC-SHA256 signature, dispatches pull_request and push events
 * to the appropriate gate if a matching gate exists for the repo.
 */

import { NextRequest, NextResponse } from "next/server";
import { findGatesByRepo, createGateRun } from "@/lib/cloud-db";
import { verifyGithubWebhookSignature, runGate } from "@/lib/gate-engine";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const eventType = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";

  // Validate webhook signature
  if (!verifyGithubWebhookSignature(rawBody, signature)) {
    logger.warn("GitHub webhook signature mismatch", {
      delivery_id: deliveryId,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Only handle pull_request and push events
  if (!["pull_request", "push"].includes(eventType)) {
    return NextResponse.json({
      skipped: true,
      reason: "Unsupported event type",
    });
  }

  const repo = payload.repository as Record<string, unknown> | undefined;
  const repoOwner = (repo?.owner as Record<string, unknown> | undefined)?.login as
    | string
    | undefined;
  const repoName = repo?.name as string | undefined;

  if (!repoOwner || !repoName) {
    return NextResponse.json({ error: "Missing repository information" }, { status: 400 });
  }

  // Extract commit SHA and PR number
  let commitSha: string | undefined;
  let prNumber: number | undefined;
  let branch: string | undefined;
  const triggerType: "pr" | "push" = eventType === "pull_request" ? "pr" : "push";

  if (eventType === "pull_request") {
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    const action = payload.action as string;
    if (!["opened", "synchronize", "reopened"].includes(action)) {
      return NextResponse.json({
        skipped: true,
        reason: `PR action "${action}" not gated`,
      });
    }
    const head = pr?.head as Record<string, unknown> | undefined;
    commitSha = head?.sha as string | undefined;
    prNumber = payload.number as number | undefined;
    branch = head?.ref as string | undefined;
  } else if (eventType === "push") {
    commitSha = payload.after as string | undefined;
    const ref = payload.ref as string | undefined;
    branch = ref?.replace("refs/heads/", "");
  }

  // Find all gates that match this repo (across all tenants — signed webhook is trusted)
  const matchingGates = findGatesByRepo(repoOwner, repoName);
  const triggeredRuns: Array<{
    gate_id: string;
    gate_run_id: string;
    tenant_id: string;
  }> = [];

  for (const { gateId, tenantId } of matchingGates) {
    try {
      const gateRun = createGateRun(tenantId, gateId, {
        trigger_type: triggerType,
        commit_sha: commitSha,
        pr_number: prNumber,
        branch,
      });

      triggeredRuns.push({
        gate_id: gateId,
        gate_run_id: gateRun.id,
        tenant_id: tenantId,
      });

      // Execute gate asynchronously
      void runGate(tenantId, gateRun.id).catch((err) => {
        logger.warn("Async gate run failed", {
          gate_run_id: gateRun.id,
          err: String(err),
        });
      });
    } catch (err) {
      logger.warn("Gate dispatch error", { gate_id: gateId, err: String(err) });
    }
  }

  return NextResponse.json({
    received: true,
    event: eventType,
    repo: `${repoOwner}/${repoName}`,
    triggered_runs: triggeredRuns.length,
    runs: triggeredRuns,
  });
}
