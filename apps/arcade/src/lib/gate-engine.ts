/**
 * ReadyLayer Gate Engine
 *
 * Executes a Gate's required_checks against the current workspace state.
 * Produces a canonical GateReport (verdict, findings, suggested fixes).
 * Posts result to GitHub as a Check Run when configured.
 */

import crypto from 'crypto';
import { env } from './env';
import { logger } from './logger';
import {
  getGate, getGateRun, updateGateRun, listWorkflowRuns, createWorkflowRun,
  updateWorkflowRun, getGithubInstallation,
  type Gate, type GateRun, type GateReport, type GateFinding, type GateCheck,
} from './cloud-db';

// ── GitHub API helpers ────────────────────────────────────────────────────

interface GitHubTokenResponse { token: string; expires_at: string }

async function getInstallationToken(installationId: number): Promise<string | null> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) return null;
  try {
    // Build JWT for GitHub App auth
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: env.GITHUB_APP_ID })).toString('base64url');
    const sigInput = `${header}.${payload}`;
    const key = crypto.createPrivateKey(env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'));
    const sig = crypto.sign('sha256', Buffer.from(sigInput), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const jwt = `${sigInput}.${sig}`;

    const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) return null;
    const data = await res.json() as GitHubTokenResponse;
    return data.token;
  } catch (err) {
    logger.warn('Failed to get GitHub installation token', { err: String(err) });
    return null;
  }
}

async function createGithubCheckRun(opts: {
  owner: string; repo: string; token: string; name: string; headSha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'action_required';
  title: string; summary: string; detailsUrl?: string;
}): Promise<number | null> {
  try {
    const body: Record<string, unknown> = {
      name: opts.name,
      head_sha: opts.headSha,
      status: opts.status,
      output: { title: opts.title, summary: opts.summary },
    };
    if (opts.conclusion) body.conclusion = opts.conclusion;
    if (opts.detailsUrl) body.details_url = opts.detailsUrl;

    const res = await fetch(`https://api.github.com/repos/${opts.owner}/${opts.repo}/check-runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn('Failed to create GitHub check run', { status: res.status });
      return null;
    }
    const data = await res.json() as { id: number };
    return data.id;
  } catch (err) {
    logger.warn('Error posting GitHub check run', { err: String(err) });
    return null;
  }
}

async function updateGithubCheckRun(opts: {
  owner: string; repo: string; token: string; checkRunId: number;
  conclusion: 'success' | 'failure' | 'neutral';
  title: string; summary: string; text?: string; detailsUrl?: string;
}): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      status: 'completed',
      conclusion: opts.conclusion,
      output: { title: opts.title, summary: opts.summary, text: opts.text ?? '' },
    };
    if (opts.detailsUrl) body.details_url = opts.detailsUrl;

    await fetch(`https://api.github.com/repos/${opts.owner}/${opts.repo}/check-runs/${opts.checkRunId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn('Error updating GitHub check run', { err: String(err) });
  }
}

// ── Check Evaluator ───────────────────────────────────────────────────────

function evaluateCheck(check: GateCheck, recentRuns: ReturnType<typeof listWorkflowRuns>): { passed: boolean; finding: GateFinding | null } {
  // Evaluate each check type based on recent workflow runs
  const relevantRuns = recentRuns.filter((r) => {
    const meta = JSON.parse(r.metrics_json ?? '{}') as Record<string, unknown>;
    return meta.check_ref === check.ref_id || r.workflow_id === check.ref_id;
  });

  if (relevantRuns.length === 0) {
    return {
      passed: false,
      finding: {
        rule: check.name,
        severity: 'warning',
        message: `No recent runs found for check "${check.name}".`,
        fix: `Trigger a run of "${check.name}" before merging, or add it to your CI pipeline.`,
      },
    };
  }

  const latest = relevantRuns[0];
  if (latest.status === 'failed' || latest.error) {
    return {
      passed: false,
      finding: {
        rule: check.name,
        severity: 'error',
        message: latest.error ?? `Check "${check.name}" failed in the latest run.`,
        fix: `Review the run output, fix the failing assertion, and re-run before merging.`,
      },
    };
  }

  if (latest.status !== 'completed') {
    return {
      passed: false,
      finding: {
        rule: check.name,
        severity: 'warning',
        message: `Check "${check.name}" has not completed yet (status: ${latest.status}).`,
        fix: `Wait for the run to complete or manually re-trigger it.`,
      },
    };
  }

  return { passed: true, finding: null };
}

// ── Gate Runner ───────────────────────────────────────────────────────────

export async function runGate(tenantId: string, gateRunId: string): Promise<GateReport> {
  const gateRun = getGateRun(gateRunId, tenantId);
  if (!gateRun) throw new Error(`Gate run ${gateRunId} not found`);

  const gate = getGate(gateRun.gate_id, tenantId);
  if (!gate) throw new Error(`Gate ${gateRun.gate_id} not found`);

  const baseUrl = env.READYLAYER_BASE_URL ?? 'https://app.readylayer.com';
  const reportUrl = `${baseUrl}/reports/${gateRunId}`;

  // Post initial GitHub check run
  let checkRunId: number | null = null;
  const installation = getGithubInstallation(tenantId, gate.repo_owner, gate.repo_name);
  let ghToken: string | null = null;

  if (installation?.installation_id) {
    ghToken = await getInstallationToken(installation.installation_id);
  } else if (installation?.access_token) {
    ghToken = installation.access_token;
  }

  if (ghToken && gateRun.commit_sha) {
    checkRunId = await createGithubCheckRun({
      owner: gate.repo_owner, repo: gate.repo_name, token: ghToken,
      name: 'ReadyLayer Gate', headSha: gateRun.commit_sha,
      status: 'in_progress',
      title: `Running ${gate.required_checks.length} check(s)…`,
      summary: `Gate "${gate.name}" is evaluating your agent readiness.`,
      detailsUrl: reportUrl,
    });
    if (checkRunId) {
      updateGateRun(gateRunId, tenantId, { github_check_run_id: checkRunId });
    }
  }

  // Execute checks
  const recentRuns = listWorkflowRuns(tenantId, undefined, 100);
  const findings: GateFinding[] = [];
  let passedCount = 0;

  for (const check of gate.required_checks) {
    const { passed, finding } = evaluateCheck(check, recentRuns);
    if (passed) {
      passedCount++;
    } else if (finding) {
      findings.push(finding);
    }
  }

  const totalChecks = gate.required_checks.length;
  const passRate = totalChecks > 0 ? passedCount / totalChecks : 1;
  const violations = findings.filter((f) => f.severity === 'error').length;

  const verdict = (
    passRate >= gate.thresholds.pass_rate &&
    violations <= gate.thresholds.max_violations
  ) ? 'passed' : 'failed';

  const topFindings = findings.slice(0, 3);
  const summary = verdict === 'passed'
    ? `All ${totalChecks} check(s) passed. Agent is ready to deploy.`
    : `${findings.length} issue(s) found across ${totalChecks} check(s). Review before merging.`;

  const report: GateReport = {
    verdict,
    pass_rate: passRate,
    violations,
    findings: topFindings,
    summary,
    report_url: reportUrl,
  };

  // Update gate run record
  updateGateRun(gateRunId, tenantId, {
    status: verdict as GateRun['status'],
    report,
    finished_at: new Date().toISOString(),
  });

  // Create a workflow run record linking to this gate run
  const allWorkflows = listWorkflowRuns(tenantId, undefined, 1);
  if (allWorkflows.length > 0) {
    const wr = createWorkflowRun(tenantId, allWorkflows[0].workflow_id, {
      gate_run_id: gateRunId,
      trigger_type: gateRun.trigger_type,
      commit_sha: gateRun.commit_sha,
    });
    updateWorkflowRun(wr.id, tenantId, {
      status: verdict === 'passed' ? 'completed' : 'failed',
      outputs_json: JSON.stringify({ report }),
      finished_at: new Date().toISOString(),
    });
    updateGateRun(gateRunId, tenantId, { workflow_run_id: wr.id });
  }

  // Update GitHub check run with final result
  if (ghToken && checkRunId) {
    const detailText = topFindings.map((f, i) =>
      `**Finding ${i + 1}: ${f.rule}**\n${f.message}\n\n_Suggested fix:_ ${f.fix}`
    ).join('\n\n---\n\n');

    await updateGithubCheckRun({
      owner: gate.repo_owner, repo: gate.repo_name,
      token: ghToken, checkRunId,
      conclusion: verdict === 'passed' ? 'success' : 'failure',
      title: verdict === 'passed' ? 'PASSED — Agent ready' : 'NEEDS ATTENTION',
      summary,
      text: detailText || undefined,
      detailsUrl: reportUrl,
    });
  }

  return report;
}

// ── Webhook Signature Validation ──────────────────────────────────────────

export function verifyGithubWebhookSignature(payload: string, signature: string): boolean {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function verifyCiTokenSignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
