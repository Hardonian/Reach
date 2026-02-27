import fs from 'fs';
import path from 'path';
import { hash } from '../lib/hash';
import { execSync } from 'child_process';

export type TaskClass = 'refactor' | 'bugfix' | 'docs' | 'security' | 'perf' | 'ui' | 'infra';
export type ArbitrationDecisionType = 'SELECT_ONE' | 'REQUEST_REWORK' | 'PROPOSE_MERGE_PLAN' | 'SELECT_ONE_WITH_PATCHUPS';

export interface PatchPack {
  pack_version: '1.0';
  provider: string;
  model: string;
  agent_id: string;
  task_class: TaskClass;
  base_sha: string;
  head_sha: string;
  diff: { format: 'git'; content: string };
  changed_paths: string[];
  metadata: {
    confidence: number;
    risk_summary: string;
    context_hash: string;
    claimed_invariants_changed: string[];
    requires_acknowledgement: boolean;
  };
  artifacts: {
    dgl_report_path?: string;
    openapi_diff_path?: string;
    route_test_results_path?: string;
    replay_id?: string;
  };
}

interface ScoreConfig {
  risk_threshold: number;
  select_margin: number;
  merge_text_conflict_threshold: number;
  weights: Record<string, number>;
  high_risk_paths: string[];
}

interface PatchScore {
  pack_id: string;
  score_total: number;
  score_breakdown: Record<string, number>;
  top_risks: string[];
  top_strengths: string[];
}

interface ConflictScore {
  text_conflict: number;
  structural_conflict: number;
  semantic_conflict: number;
  boundary_conflict: number;
  reasons: string[];
}

export interface CpxReport {
  run_id: string;
  timestamp: string;
  base_sha: string;
  packs: Array<{ pack_id: string; provider: string; model: string; patch_content_hash: string; patch_structural_hash: string; patch_intent_hash: string }>;
  per_patch: PatchScore[];
  conflict_matrix: Record<string, Record<string, ConflictScore>>;
  arbitration: { decision_type: ArbitrationDecisionType; selected_pack_id?: string; rationale: string[]; recommended_next_actions: string[]; merge_plan_path?: string };
}


export function validatePatchPack(pack: unknown): { ok: boolean; errors: string[] } {
  const p = pack as Partial<PatchPack>;
  const errors: string[] = [];
  if (p.pack_version !== '1.0') errors.push('pack_version must be 1.0');
  if (!p.provider) errors.push('provider missing');
  if (!p.model) errors.push('model missing');
  if (!p.agent_id) errors.push('agent_id missing');
  if (!p.base_sha || !p.head_sha) errors.push('base_sha/head_sha missing');
  if (!p.diff || p.diff.format !== 'git' || !p.diff.content) errors.push('diff invalid');
  if (!Array.isArray(p.changed_paths) || p.changed_paths.length === 0) errors.push('changed_paths must be non-empty');
  if (!p.metadata) errors.push('metadata missing');
  return { ok: errors.length === 0, errors };
}

function stableHash(parts: unknown[]): string {
  return hash(JSON.stringify(parts));
}

function normalizePack(pack: PatchPack) {
  const normalizedPaths = [...pack.changed_paths].map((p) => p.replace(/\\/g, '/')).sort();
  const diff = pack.diff.content.replace(/\r\n/g, '\n').trimEnd() + '\n';
  const patch_content_hash = stableHash([diff, normalizedPaths]);
  const patch_structural_hash = stableHash(normalizedPaths.map((p) => p.split('/').slice(0, 2).join('/')));
  const patch_intent_hash = stableHash([pack.task_class, pack.metadata.claimed_invariants_changed.slice().sort(), pack.metadata.context_hash]);
  return { ...pack, changed_paths: normalizedPaths, diff: { ...pack.diff, content: diff }, patch_content_hash, patch_structural_hash, patch_intent_hash };
}

function readJsonFile<T>(p: string, fallback: T): T {
  try {
    if (!p || !fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function computeScore(pack: ReturnType<typeof normalizePack>, config: ScoreConfig): PatchScore {
  const breakdown: Record<string, number> = {};
  const risks: string[] = [];
  const strengths: string[] = [];

  const dgl = pack.artifacts.dgl_report_path
    ? readJsonFile<{ violations?: Array<{ severity?: string; type?: string }> }>(pack.artifacts.dgl_report_path, {})
    : {};
  const violations = dgl.violations ?? [];
  const dglErrorPenalty = violations.filter((v) => v.severity === 'error').length * config.weights.dgl_error;
  const dglWarnPenalty = violations.filter((v) => v.severity === 'warn').length * config.weights.dgl_warn;
  breakdown.dgl_error = dglErrorPenalty;
  breakdown.dgl_warn = dglWarnPenalty;

  const openApi = pack.artifacts.openapi_diff_path
    ? readJsonFile<{ summary?: { breaking?: number } }>(pack.artifacts.openapi_diff_path, {})
    : {};
  const openapiBreak = Number(openApi.summary?.breaking ?? 0);
  breakdown.openapi_break = openapiBreak * config.weights.openapi_break;

  const trustTouches = pack.changed_paths.filter((p) => config.high_risk_paths.some((h) => p.toLowerCase().includes(h.toLowerCase()))).length;
  breakdown.trust_boundary = trustTouches * config.weights.trust_boundary;

  const diffLines = pack.diff.content.split('\n').length;
  breakdown.blast_radius = Math.min(1, diffLines / 400) * config.weights.blast_radius;

  const providerCalibration = Math.max(0, 1 - Math.abs(pack.metadata.confidence - 0.8));
  breakdown.provider_calibration = -providerCalibration * config.weights.provider_calibration;

  breakdown.ack_penalty = pack.metadata.requires_acknowledgement ? config.weights.ack_penalty : 0;

  const route = pack.artifacts.route_test_results_path
    ? readJsonFile<{ failed?: number; total?: number }>(pack.artifacts.route_test_results_path, {})
    : {};
  const mismatch = route.total ? Number(route.failed ?? 0) / Number(route.total) : 0;
  breakdown.route_mismatch = mismatch * config.weights.route_mismatch;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (trustTouches > 0) risks.push(`Touches ${trustTouches} high-risk paths`);
  if (openapiBreak > 0) risks.push(`Contains ${openapiBreak} OpenAPI break(s)`);
  if (pack.metadata.requires_acknowledgement) risks.push('Missing explicit acknowledgement for risky changes');
  if (violations.length === 0) strengths.push('No DGL violations in supplied report');
  if (mismatch === 0) strengths.push('No route mismatch signal provided');
  strengths.push(`Provider confidence ${Math.round(pack.metadata.confidence * 100)}%`);

  return {
    pack_id: pack.patch_content_hash,
    score_total: Number(total.toFixed(6)),
    score_breakdown: breakdown,
    top_risks: risks.slice(0, 5),
    top_strengths: strengths.slice(0, 5),
  };
}

function parseChangedRanges(diff: string): Record<string, Set<number>> {
  const ranges: Record<string, Set<number>> = {};
  let current = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) current = line.replace('+++ b/', '');
    const m = line.match(/^@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s+@@/);
    if (m && current) {
      const start = Number(m[3]);
      const count = Number(m[4] ?? '1');
      const set = ranges[current] ?? new Set<number>();
      for (let i = 0; i < count; i += 1) set.add(start + i);
      ranges[current] = set;
    }
  }
  return ranges;
}

function conflict(a: ReturnType<typeof normalizePack>, b: ReturnType<typeof normalizePack>, config: ScoreConfig): ConflictScore {
  const reasons: string[] = [];
  const aSet = new Set(a.changed_paths);
  const overlap = b.changed_paths.filter((p) => aSet.has(p));
  const textA = parseChangedRanges(a.diff.content);
  const textB = parseChangedRanges(b.diff.content);
  let overlappingLines = 0;
  for (const f of overlap) {
    const la = textA[f] ?? new Set<number>();
    const lb = textB[f] ?? new Set<number>();
    for (const n of la) if (lb.has(n)) overlappingLines += 1;
  }
  const textConflict = Math.min(1, overlappingLines / 20);
  if (textConflict > 0) reasons.push(`Overlapping hunks detected on ${overlap.length} file(s)`);

  const structuralConflict = Math.min(1, overlap.filter((p) => /index\.|api|schema|types\./.test(p)).length / 5);
  if (structuralConflict > 0) reasons.push('Shared public surface files changed');

  const semanticConflict = a.task_class === b.task_class ? 0.2 : 0.7;
  if (semanticConflict > 0.5) reasons.push('Task intent differs between patches');

  const boundaryConflict = Math.min(1, overlap.filter((p) => config.high_risk_paths.some((h) => p.includes(h))).length / 2);
  if (boundaryConflict > 0) reasons.push('Overlapping trust boundary paths');

  return { text_conflict: textConflict, structural_conflict: structuralConflict, semantic_conflict: semanticConflict, boundary_conflict: boundaryConflict, reasons };
}

function decide(scores: PatchScore[], matrix: Record<string, Record<string, ConflictScore>>, config: ScoreConfig) {
  const sorted = [...scores].sort((a, b) => a.score_total - b.score_total || a.pack_id.localeCompare(b.pack_id));
  const best = sorted[0];
  const second = sorted[1];
  const rationale: string[] = [];
  const actions: string[] = [];
  if (!best) return { decision_type: 'REQUEST_REWORK' as const, rationale: ['No valid patches were supplied.'], recommended_next_actions: ['Provide at least two valid patch packs.'] };
  if (best.score_total > config.risk_threshold) {
    return { decision_type: 'REQUEST_REWORK' as const, rationale: ['All candidates exceed risk threshold.'], recommended_next_actions: ['Reduce trust boundary impact and resolve OpenAPI breaks.'] };
  }
  const maxConflict = second ? Math.max(matrix[best.pack_id]?.[second.pack_id]?.text_conflict ?? 0, matrix[best.pack_id]?.[second.pack_id]?.semantic_conflict ?? 0) : 0;
  if (second && maxConflict > config.merge_text_conflict_threshold && (matrix[best.pack_id]?.[second.pack_id]?.semantic_conflict ?? 0) > 0.5) {
    return { decision_type: 'PROPOSE_MERGE_PLAN' as const, rationale: ['Candidates overlap with semantic disagreement.'], recommended_next_actions: ['Use generated merge plan and run targeted route + contract tests.'] };
  }
  if (second && (second.score_total - best.score_total) < config.select_margin) {
    return { decision_type: 'PROPOSE_MERGE_PLAN' as const, rationale: ['Candidates are similarly scored and potentially complementary.'], recommended_next_actions: ['Merge non-overlapping modules first, then reconcile shared files.'] };
  }
  rationale.push('Best candidate exceeds selection margin with low conflict.');
  actions.push('Promote selected patch through ReadyLayer Arbitration Gate.');
  return { decision_type: 'SELECT_ONE' as const, selected_pack_id: best.pack_id, rationale, recommended_next_actions: actions };
}

export function runCpx(packs: PatchPack[], rootDir: string): CpxReport {
  if (packs.length < 2) throw new Error('CPX requires at least two patch packs');
  const baseSha = packs[0]?.base_sha;
  if (!baseSha || packs.some((p) => p.base_sha !== baseSha)) throw new Error('All packs must share the same base_sha');
  const config = readJsonFile<ScoreConfig>(path.join(rootDir, 'config', 'cpx-scoring.json'), {
    risk_threshold: 0.5,
    select_margin: 0.1,
    merge_text_conflict_threshold: 0.25,
    weights: { dgl_error: 0.35, dgl_warn: 0.1, openapi_break: 0.2, trust_boundary: 0.2, perf: 0.08, blast_radius: 0.08, provider_calibration: 0.08, economics: 0.05, route_mismatch: 0.06, ack_penalty: 0.08 },
    high_risk_paths: ['auth/', 'billing/', 'webhook'],
  });
  const normalized = packs.map(normalizePack).sort((a, b) => a.patch_content_hash.localeCompare(b.patch_content_hash));
  const cacheDir = path.join(rootDir, '.cache', 'dgl', 'cpx');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheKey = stableHash([baseSha, normalized.map((p) => [p.patch_content_hash, p.patch_structural_hash, p.patch_intent_hash]), config]);
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  if (fs.existsSync(cachePath)) return readJsonFile<CpxReport>(cachePath, {} as CpxReport);

  const perPatch = normalized.map((p) => computeScore(p, config));
  const matrix: Record<string, Record<string, ConflictScore>> = {};
  for (const left of normalized) {
    matrix[left.patch_content_hash] = {};
    for (const right of normalized) {
      if (left.patch_content_hash === right.patch_content_hash) continue;
      matrix[left.patch_content_hash][right.patch_content_hash] = conflict(left, right, config);
    }
  }

  const arbitration = decide(perPatch, matrix, config);
  const runId = stableHash([baseSha, normalized.map((p) => p.patch_content_hash), arbitration.decision_type]).slice(0, 16);
  const report: CpxReport = {
    run_id: `cpx-${runId}`,
    timestamp: new Date().toISOString(),
    base_sha: baseSha,
    packs: normalized.map((p) => ({ pack_id: p.patch_content_hash, provider: p.provider, model: p.model, patch_content_hash: p.patch_content_hash, patch_structural_hash: p.patch_structural_hash, patch_intent_hash: p.patch_intent_hash })),
    per_patch: perPatch,
    conflict_matrix: matrix,
    arbitration,
  };
  fs.writeFileSync(cachePath, JSON.stringify(report, null, 2));
  return report;
}

export function cpxToMarkdown(report: CpxReport): string {
  const lines = [
    '# CPX Arbitration Summary',
    '',
    `- Run: ${report.run_id}`,
    `- Decision: ${report.arbitration.decision_type}`,
    report.arbitration.selected_pack_id ? `- Selected Pack: ${report.arbitration.selected_pack_id}` : '',
    '',
    '## Top reasons',
    ...report.arbitration.rationale.map((r) => `- ${r}`),
    '',
    '## Next actions',
    ...report.arbitration.recommended_next_actions.map((a) => `- ${a}`),
  ].filter(Boolean);
  return `${lines.join('\n')}\n`;
}

export function cpxToSarif(report: CpxReport): Record<string, unknown> {
  const results = report.per_patch.flatMap((patch) => patch.top_risks.map((risk) => ({
    ruleId: 'CPX_RISK',
    level: 'warning',
    message: { text: `${patch.pack_id}: ${risk}` },
  })));
  return {
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'Reach CPX', version: '1.0.0' } }, results }],
  };
}

export function createPackFromGit(baseRef: string, headRef: string, provider: string, model: string, agentId: string, taskClass: TaskClass): PatchPack {
  const exec = (cmd: string) => execSync(cmd, { encoding: 'utf-8' }).trim();
  const diff = exec(`git diff --no-color ${baseRef} ${headRef}`);
  const changed = exec(`git diff --name-only ${baseRef} ${headRef}`).split('\n').filter(Boolean).sort();
  return {
    pack_version: '1.0',
    provider,
    model,
    agent_id: agentId,
    task_class: taskClass,
    base_sha: exec(`git rev-parse ${baseRef}`),
    head_sha: exec(`git rev-parse ${headRef}`),
    diff: { format: 'git', content: diff },
    changed_paths: changed,
    metadata: { confidence: 0.75, risk_summary: 'Generated from git diff.', context_hash: stableHash([baseRef, headRef, changed]), claimed_invariants_changed: [], requires_acknowledgement: false },
    artifacts: {},
  };
}
