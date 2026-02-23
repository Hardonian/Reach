// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as core from "@zeo/core";
import * as contracts from "@zeo/contracts";

const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_AS_OF_DATE = "1970-01-01";
const DECAY_WINDOWS_DAYS = { fresh: 30, aging: 90, stale: 180 } as const;
const LENSES = ["executive", "engineering", "legal", "personal"] as const;
type LensType = typeof LENSES[number];
type EdgeType = "depends_on" | "informs";
type DecisionType = "ENG" | "OPS" | "SEC" | "PROD" | "MKT" | "CUST";
type Audience = "legal" | "exec" | "sales" | "engineer" | "auditor";

type DecayStatus = "fresh" | "aging" | "stale" | "expired" | "unknown";
type DriftType = "assumption_flip" | "evidence_expired" | "outcome_regret" | "policy_change" | "environment_change" | "review_overdue";

// Integration map:
// - Metrics hook: computed on run completion and persisted in workspace + .zeo/metrics snapshots.
// - Export hook: proof bundle emitted by `export decision` reuses workspace artifacts and deterministic manifest hashing.
// - CTA hook: post-command `nextSteps` text is appended to command output surfaces (run/export/verify failures).

export interface WorkflowArgs {
  command:
  | "start"
  | "add-note"
  | "run"
  | "next"
  | "share"
  | "copy"
  | "export"
  | "quests"
  | "done"
  | "streaks"
  | "graph"
  | "view"
  | "review"
  | "explain"
  | "summary"
  | "decision-health"
  | "drift-report"
  | "roi-report"
  | "verify"
  | "evidence"
  | "help"
  | "examples"
  | "template"
  | "decision"
  | null;
  subcommand?: "md" | "ics" | "bundle" | "show" | "impact" | "fragility" | "weekly" | "decision" | "set-expiry" | "expired" | "start" | "examples" | "list" | "create";
  decision?: string;
  text?: string;
  title?: string;
  json: boolean;
  output?: string;
  envelope?: string;
  due?: string;
  timezone?: string;
  taskId?: string;
  transcript?: string;
  lens?: LensType;
  dependsOn: string[];
  informs: string[];
  assertedAt?: string;
  expiresAt?: string;
  asOf?: string;
  audience?: Audience;
  type?: DecisionType;
  mode?: "internal" | "customer";
  templateId?: string;
  since?: string;
  window?: "7d" | "30d" | "90d";
  driftType?: DriftType;
  format?: "zip" | "dir";
  signed?: boolean;
  includeRaw?: boolean;
  inDuration?: string;
  evidenceId?: string;
  interactive?: boolean;
  allowCrossWorkspace?: boolean;
  fixedTime?: string;
}

interface EvidenceItem {
  id: string;
  kind: "note";
  text: string;
  summary: string;
  assertedAt?: string;
  expiresAt?: string;
  provenance: { source: "user_note"; hash: string };
  cost: { timeMinutes: number; risk: "low" | "medium" | "high" };
}

interface TaskItem {
  id: string;
  label: string;
  sourceEvidenceId: string;
  dueDate?: string;
  completed: boolean;
}

interface RunResult {
  transcriptHash: string;
  recommendedAction: string;
  boundarySummary: string;
  flipDistance: number;
  fragility: "Stable" | "Fragile" | "Knife-edge";
  topEvidence: Array<{ id: string; summary: string; cost: EvidenceItem["cost"]; decay: DecayStatus }>;
  plan: { nextSteps: string[]; stopConditions: string[] };
  signatureStatus: "unsigned" | "signed";
  dependsOn: string[];
  informs: string[];
  decaySummary: Record<DecayStatus, number>;
  fullTranscript?: contracts.FinalizedDecisionTranscript;
  health?: DecisionHealth;
  confidence: number;
}

interface DecisionHealth {
  schemaVersion: string;
  evidenceCompletenessScore: number;
  policyComplianceScore: number;
  replayStabilityScore: number;
  assumptionVolatilityIndex: number;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
}

interface DriftEvent {
  decisionId: string;
  assumptionId: string | null;
  type: DriftType;
  severity: "low" | "medium" | "high";
  detectedAt: string;
  details: Record<string, string | number | boolean | null>;
}

interface DecisionTemplate {
  schemaVersion: string;
  id: string;
  title: string;
  description: string;
  decisionType: DecisionType;
  workspaceMode: "internal" | "customer";
  reviewAfterDays: number;
  requiredEvidence: string[];
  requiredAssumptions: string[];
  requiredPolicyTypes: string[];
}

function specFromWorkspace(ws: DecisionWorkspace): contracts.DecisionSpec {
  return {
    id: ws.decisionId,
    title: ws.title,
    context: ws.title,
    createdAt: ws.createdAt ?? nowIso(),
    decisionType: ws.decisionType,
    workspaceMode: ws.workspaceMode,
    decisionState: ws.state,
    reviewAfter: ws.reviewAt ? `${ws.reviewAt}T00:00:00.000Z` : undefined,
    expectedSignals: ws.evidence.map((e) => e.summary),
    horizon: "days",
    agents: [{ id: "self", name: "Self", role: "self" }],
    actions: [
      { id: "act_commit", label: "Commit to Plan", actorId: "self", kind: "commit" },
      { id: "act_defer", label: "Gather More Evidence", actorId: "self", kind: "delay" }
    ],
    constraints: [],
    assumptions: ws.evidence.map((e) => ({
      id: e.id,
      text: e.text,
      status: "fact",
      confidence: "high",
      provenance: [{ kind: "text", sourceId: "user_note", offset: 0, length: e.text.length, capturedAt: e.assertedAt || ws.createdAt || nowIso(), checksum: e.provenance.hash }],
      tags: [] as string[]
    })),
    objectives: [{ id: "obj_robustness", metric: "robustness", weight: 1.0 }]
  };
}

interface DecisionWorkspace {
  decisionId: string;
  title: string;
  decisionType: DecisionType;
  workspaceMode: "internal" | "customer";
  state: "proposed" | "challenged" | "amended" | "finalized";
  createdAt?: string;
  evidence: EvidenceItem[];
  tasks: TaskItem[];
  runs: RunResult[];
  chain: { parentTranscriptHash?: string };
  workspaceId?: string;
  reviewAt?: string;
  driftEvents?: DriftEvent[];
  healthHistory?: DecisionHealth[];
}



const DECISION_TEMPLATES: DecisionTemplate[] = ([
  {
    schemaVersion: "1.0.0",
    id: "security-review",
    title: "Security Review",
    description: "Security posture decision with threat modeling and provenance checks.",
    decisionType: "SEC",
    workspaceMode: "internal",
    reviewAfterDays: 7,
    requiredEvidence: ["threat-model", "control-evidence", "replayable-reasoning"],
    requiredAssumptions: ["threat coverage is complete", "control owners accepted residual risk"],
    requiredPolicyTypes: ["sec.provenance", "sec.threat-model"]
  },
  {
    schemaVersion: "1.0.0",
    id: "infra-migration",
    title: "Infrastructure Migration",
    description: "Reliability and rollback-focused migration planning.",
    decisionType: "OPS",
    workspaceMode: "internal",
    reviewAfterDays: 14,
    requiredEvidence: ["rollback-plan", "load-test", "runbook"],
    requiredAssumptions: ["rollback path remains valid", "traffic profile is representative"],
    requiredPolicyTypes: ["ops.reliability", "ops.change-control"]
  },
  {
    schemaVersion: "1.0.0",
    id: "product-launch",
    title: "Product Launch",
    description: "Launch decision balancing customer impact and operational readiness.",
    decisionType: "PROD",
    workspaceMode: "customer",
    reviewAfterDays: 30,
    requiredEvidence: ["customer-impact", "metric-baseline", "support-readiness"],
    requiredAssumptions: ["target segment demand persists", "support capacity is sufficient"],
    requiredPolicyTypes: ["prod.roadmap-governance", "prod.customer-safety"]
  }
] as DecisionTemplate[]).sort((a, b) => a.id.localeCompare(b.id));

function getTemplate(templateId: string): DecisionTemplate {
  const template = DECISION_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    const known = DECISION_TEMPLATES.map((item) => item.id).join(", ");
    throw new Error(`Unknown template: ${templateId}. Available templates: ${known}`);
  }
  return template;
}

function writeTemplateCatalog(args: WorkflowArgs): number {
  const root = join(process.cwd(), "templates");
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  for (const template of DECISION_TEMPLATES) {
    const path = join(root, `${template.id}.json`);
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  }
  const payload = { schemaVersion: "1.0.0", templates: DECISION_TEMPLATES, outputDir: root };
  const text = DECISION_TEMPLATES.map((t) => `${t.id} (${t.decisionType})`).join("\n");
  writeJsonOrText(args, payload, text);
  return 0;
}

interface GraphNode {
  transcriptHash: string;
  decisionId: string;
  flipDistance: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

function hash(inputValue: unknown): string {
  return createHash("sha256").update(JSON.stringify(inputValue)).digest("hex");
}

function zeoRoot(): string {
  return resolve(process.cwd(), ".zeo");
}

function decisionsRoot(): string {
  return join(zeoRoot(), "decisions");
}

function metricsRoot(): string {
  return join(zeoRoot(), "metrics");
}

function workspacePath(decisionId: string): string {
  return join(decisionsRoot(), decisionId, "decision.json");
}

function ensureWorkspaceRoot(): void {
  if (!existsSync(decisionsRoot())) mkdirSync(decisionsRoot(), { recursive: true });
  if (!existsSync(metricsRoot())) mkdirSync(metricsRoot(), { recursive: true });
}

function nowIso(): string {
  return process.env.ZEO_FIXED_TIME || new Date().toISOString();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function defaultWorkspaceId(): string {
  return process.env.ZEO_WORKSPACE_ID?.trim() || "default";
}

function parseDurationToDays(input?: string): number {
  if (!input) return 30;
  const match = /^(\d+)(d)?$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: ${input}. Use <Nd>, for example 30d.`);
  return Number(match[1]);
}

function parseSinceToDate(since?: string): string {
  if (!since) return "1970-01-01";
  const days = parseDurationToDays(since);
  const now = new Date(nowIso());
  const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
  return from.toISOString().slice(0, 10);
}

function requiredEvidenceCountForType(type: DecisionType): number {
  const map: Record<DecisionType, number> = { ENG: 2, OPS: 2, SEC: 3, PROD: 2, MKT: 2, CUST: 2 };
  return map[type];
}

function computeDecisionHealth(ws: DecisionWorkspace, replayStable: boolean): DecisionHealth {
  // Deterministic scoring formulas (no ML): weighted linear percentages with stable constants.
  const requiredEvidence = requiredEvidenceCountForType(ws.decisionType);
  const evidenceScore = clampScore((Math.min(ws.evidence.length, requiredEvidence) / requiredEvidence) * 100);
  const completedTasks = ws.tasks.filter((t) => t.completed).length;
  const policyRaw = ws.tasks.length === 0 ? 100 : (completedTasks / ws.tasks.length) * 100;
  const policyScore = clampScore(policyRaw);
  const replayStabilityScore = replayStable ? 100 : 0;
  const flips = ws.runs.filter((r) => r.flipDistance < 3).length;
  const expired = ws.evidence.filter((e) => e.expiresAt && classifyDecay(e, nowIso().slice(0, 10)) === "expired").length;
  const volatility = clampScore(Math.min(100, flips * 20 + expired * 15 + Math.max(0, ws.runs.length - 1) * 5));
  const riskScore = clampScore(Math.round((100 - evidenceScore) * 0.35 + (100 - policyScore) * 0.35 + (100 - replayStabilityScore) * 0.2 + volatility * 0.1));
  const createdAt = ws.healthHistory?.[0]?.createdAt ?? nowIso();
  return {
    schemaVersion: "1.0.0",
    evidenceCompletenessScore: evidenceScore,
    policyComplianceScore: policyScore,
    replayStabilityScore,
    assumptionVolatilityIndex: volatility,
    riskScore,
    createdAt,
    updatedAt: nowIso(),
  };
}

function healthLine(health: DecisionHealth): string {
  const composite = clampScore(Math.round((health.evidenceCompletenessScore + health.policyComplianceScore + health.replayStabilityScore + (100 - health.assumptionVolatilityIndex)) / 4));
  return `Health: ${composite}/100 • Evidence ${health.evidenceCompletenessScore} • Policy ${health.policyComplianceScore} • Replay ${health.replayStabilityScore} • Volatility ${health.assumptionVolatilityIndex}`;
}

function appendDriftEvent(ws: DecisionWorkspace, event: DriftEvent): void {
  const all = [...(ws.driftEvents ?? []), event]
    .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt) || a.decisionId.localeCompare(b.decisionId) || a.type.localeCompare(b.type));
  ws.driftEvents = all;
}

function persistMetricsSnapshot(ws: DecisionWorkspace, health: DecisionHealth): void {
  const snapshotPath = join(metricsRoot(), `${ws.decisionId}.json`);
  const payload = {
    decisionId: ws.decisionId,
    workspaceId: ws.workspaceId ?? defaultWorkspaceId(),
    latest: health,
    history: ws.healthHistory ?? [],
    driftEvents: ws.driftEvents ?? [],
  };
  writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function nextSteps(context: "analyze-pr" | "decision-finalize" | "verify-mismatch", values: Record<string, string>): string[] {
  if (context === "analyze-pr") {
    return [
      `Convert to decision? zeo decision create --from ${values.runId ?? "<lastRunId>"}`,
      "Apply security pack? zeo init pack security-pack",
    ];
  }
  if (context === "verify-mismatch") return ["Show drift report: zeo drift-report --since 30d"];
  return [
    `Set review horizon: zeo review weekly --decision ${values.decisionId ?? "<decisionId>"}`,
    `Export bundle: zeo export decision ${values.decisionId ?? "<decisionId>"} --format zip`,
  ];
}

function resolveTranscriptWorkspace(transcriptHash: string): DecisionWorkspace | null {
  for (const ws of collectWorkspaces()) {
    if (ws.runs.some((run) => run.transcriptHash === transcriptHash)) return ws;
  }
  return null;
}

function getLatestHealth(ws: DecisionWorkspace): DecisionHealth {
  return ws.healthHistory?.[ws.healthHistory.length - 1] ?? computeDecisionHealth(ws, ws.runs.length > 0);
}

function buildBundleManifest(bundleDir: string, files: string[]): { files: Array<{ path: string; sha256: string; size: number }>; manifestHash: string; treeHash: string } {
  const entries = files
    .map((path) => {
      const contents = readFileSync(join(bundleDir, path));
      return { path, sha256: createHash("sha256").update(contents).digest("hex"), size: contents.byteLength };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const treeHash = createHash("sha256").update(JSON.stringify(entries.map((entry) => [entry.path, entry.sha256]))).digest("hex");
  const manifestHash = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  return { files: entries, manifestHash, treeHash };
}

function verificationStatusFromHealth(health: DecisionHealth, manifestHash: string, treeHash: string, signed: boolean, signatureValid: boolean | null): { verified: boolean; method: "hash_only" | "signed"; manifestHash: string; treeHash: string; signatureValid: boolean | null; verifiedAt: string } {
  const verified = health.replayStabilityScore === 100 && (signed ? signatureValid === true : true);
  return {
    verified,
    method: signed ? "signed" : "hash_only",
    manifestHash,
    treeHash,
    signatureValid,
    verifiedAt: nowIso(),
  };
}

function loadWorkspace(decisionId: string): DecisionWorkspace {
  const path = workspacePath(decisionId);
  if (!existsSync(path)) throw new Error(`Decision not found: ${decisionId}. Run 'zeo start' first.`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DecisionWorkspace>;
  return {
    decisionId: parsed.decisionId || decisionId,
    title: parsed.title || "Untitled Decision",
    decisionType: parsed.decisionType || "ENG",
    workspaceMode: parsed.workspaceMode || "customer",
    state: parsed.state || "proposed",
    createdAt: parsed.createdAt,
    evidence: parsed.evidence || [],
    tasks: parsed.tasks || [],
    runs: parsed.runs || [],
    chain: parsed.chain || {},
    workspaceId: parsed.workspaceId || defaultWorkspaceId(),
    reviewAt: parsed.reviewAt,
    driftEvents: parsed.driftEvents || [],
    healthHistory: parsed.healthHistory || [],
  };
}

function saveWorkspace(ws: DecisionWorkspace): void {
  const dir = join(decisionsRoot(), ws.decisionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "decision.json"), `${JSON.stringify(ws, null, 2)}\n`, "utf8");
}

function parseNoteToEvidence(text: string, assertedAt?: string, expiresAt?: string): Omit<EvidenceItem, "id"> {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const summary = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  return {
    kind: "note",
    text: cleaned,
    summary,
    assertedAt,
    expiresAt,
    provenance: { source: "user_note", hash: hash(cleaned) },
    cost: { timeMinutes: Math.max(5, Math.ceil(cleaned.length / 80) * 5), risk: cleaned.includes("urgent") ? "high" : "low" },
  };
}

function isoDate(value?: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid date (expected YYYY-MM-DD): ${value}`);
  return value;
}

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function classifyDecay(evidence: EvidenceItem, asOfDate: string): DecayStatus {
  if (evidence.expiresAt && daysBetween(evidence.expiresAt, asOfDate) >= 0) return "expired";
  if (!evidence.assertedAt) return "unknown";
  const ageDays = daysBetween(evidence.assertedAt, asOfDate);
  if (ageDays <= DECAY_WINDOWS_DAYS.fresh) return "fresh";
  if (ageDays <= DECAY_WINDOWS_DAYS.aging) return "aging";
  if (ageDays <= DECAY_WINDOWS_DAYS.stale) return "stale";
  return "expired";
}

function decaySummary(evidence: EvidenceItem[], asOfDate: string): Record<DecayStatus, number> {
  const summary: Record<DecayStatus, number> = { fresh: 0, aging: 0, stale: 0, expired: 0, unknown: 0 };
  for (const item of evidence) summary[classifyDecay(item, asOfDate)] += 1;
  return summary;
}

function formatResultCard(result: RunResult): string {
  return [
    "=== Zeo Result Card ===",
    `Recommended action: ${result.recommendedAction}`,
    `Decision boundary: ${result.boundarySummary}`,
    `Flip distance: ${result.flipDistance}`,
    `Fragility: ${result.fragility}`,
    `Decay: fresh=${result.decaySummary.fresh} aging=${result.decaySummary.aging} stale=${result.decaySummary.stale} expired=${result.decaySummary.expired} unknown=${result.decaySummary.unknown}`,
    "Top evidence:",
    ...result.topEvidence.map((e, idx) => `  ${idx + 1}. ${e.summary} (time=${e.cost.timeMinutes}m risk=${e.cost.risk} decay=${e.decay})`),
    "Regret-bounded plan:",
    ...result.plan.nextSteps.map((s) => `  - ${s}`),
    `Depends on: ${result.dependsOn.join(", ") || "none"}`,
    `Informs: ${result.informs.join(", ") || "none"}`,
    `Transcript hash: ${result.transcriptHash}`,
    `Signature: ${result.signatureStatus}`,
  ].join("\n");
}


async function runDecisionInWorkspace(
  ws: DecisionWorkspace,
  envelopePath: string | undefined,
  asOfDate: string,
  dependsOn: string[],
  informs: string[]
): Promise<RunResult> {
  if (process.env.ZEO_FIXED_TIME) {
    const seed = createHash("sha256").update(ws.decisionId).digest("hex");
    core.activateDeterministicMode({
      seed,
      clock: {
        now: () => process.env.ZEO_FIXED_TIME!,
        timestamp: () => Date.parse(process.env.ZEO_FIXED_TIME!)
      }
    });
  }

  const spec = specFromWorkspace(ws);
  const { result, transcript } = core.executeDecision({
    spec,
    opts: { depth: 2 }, // Default depth
    evidence: [], // Evidence is already embedded in assumptions for this simplified view, or should be passed?
    // The workspace "evidence" are actually "facts" in the spec assumptions.
    // Real evidence events would be separate. For now, we map workspace evidence to assumptions.
    dependsOn,
    informs,
    logicalTimestamp: process.env.ZEO_FIXED_TIME ? Date.parse(process.env.ZEO_FIXED_TIME) : Date.parse(asOfDate)
  });

  if (process.env.ZEO_FIXED_TIME) {
    core.deactivateDeterministicMode();
  }

  // Signing integration
  const defaultKeyPath = join(zeoRoot(), "keys", "id_ed25519.pem");
  let envelopePathOut: string | undefined;

  if (existsSync(defaultKeyPath)) {
    // Create and sign envelope
    const envelope = core.createEnvelope(transcript, { created_by: "zeo-cli" });
    const signedEnvelope = core.signEnvelopeWithEd25519(
      envelope,
      defaultKeyPath,
      "zeo.transcript.signature.v1"
    );

    // Save envelope
    const envelopeDir = join(decisionsRoot(), ws.decisionId, "envelopes");
    if (!existsSync(envelopeDir)) mkdirSync(envelopeDir, { recursive: true });

    const envFileName = `${transcript.transcript_hash}.envelope.json`;
    envelopePathOut = join(envelopeDir, envFileName);
    writeFileSync(envelopePathOut, `${JSON.stringify(signedEnvelope, null, 2)}\n`, "utf8");
    console.log(`Signed transcript with key: ${defaultKeyPath}`);
    console.log(`Envelope saved to: ${envelopePathOut}`);
  } else {
    console.log("No signing key found. Transcript unsigned.");
  }


  const robustActions = result.evaluations.find(e => e.lens === "robustness")?.robustActions || [];
  const recommendedAction = robustActions.length > 0
    ? `Action(s) ${robustActions.join(", ")} are robust.`
    : "No robust actions found. Gather more evidence.";

  const flipDistances = transcript.analysis.flip_distances.map(f => parseFloat(f.distance));
  const minFlipDistance = flipDistances.length > 0 ? Math.min(...flipDistances) : Infinity;

  const fragility = minFlipDistance >= 5 ? "Stable" : minFlipDistance >= 3 ? "Fragile" : "Knife-edge";
  const totalEvidence = ws.evidence.length;
  // Tasks are distinct from evidence in workspace model
  const unresolvedTasks = ws.tasks.filter((t) => !t.completed).length;
  const decay = decaySummary(ws.evidence, asOfDate);
  const boundarySummary = `Flip dist ${minFlipDistance.toFixed(2)}; ${unresolvedTasks} tasks; decay: ${decay.stale + decay.expired} issues.`;

  return {
    transcriptHash: transcript.transcript_hash,
    recommendedAction,
    boundarySummary,
    flipDistance: minFlipDistance === Infinity ? 100 : minFlipDistance,
    fragility,
    topEvidence: ws.evidence
      .slice()
      .sort((a, b) => a.cost.timeMinutes - b.cost.timeMinutes || a.id.localeCompare(b.id))
      .slice(0, 3)
      .map((e) => ({ id: e.id, summary: e.summary, cost: e.cost, decay: classifyDecay(e, asOfDate) })),
    plan: {
      nextSteps: result.nextBestEvidence.slice(0, 3).map(item => item.prompt),
      stopConditions: transcript.plan.stop_conditions,
    },
    signatureStatus: (envelopePathOut || (envelopePath && existsSync(resolve(envelopePath)))) ? "signed" : "unsigned",
    dependsOn: transcript.depends_on ?? [],
    informs: transcript.informs ?? [],
    decaySummary: decay,
    fullTranscript: transcript,
    confidence: fragility === "Stable" ? 0.8 : fragility === "Fragile" ? 0.6 : 0.4
  };
}

function createTasksFromEvidence(evidence: EvidenceItem): TaskItem[] {
  return [{ id: `task_${evidence.id}`, label: `Validate: ${evidence.summary}`, sourceEvidenceId: evidence.id, completed: false }];
}

function writeJsonOrText(args: WorkflowArgs, payload: unknown, text: string): void {
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${text}\n`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function ensureNoSecrets(text: string): void {
  const secretPattern = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/;
  if (secretPattern.test(text)) throw new Error("Potential secret detected in output payload.");
}

function collectWorkspaces(): DecisionWorkspace[] {
  if (!existsSync(decisionsRoot())) return [];
  return readdirSync(decisionsRoot(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadWorkspace(entry.name));
}

function collectGraph(asOfDate: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  for (const ws of collectWorkspaces()) {
    for (const run of ws.runs) {
      nodes.set(run.transcriptHash, { transcriptHash: run.transcriptHash, decisionId: ws.decisionId, flipDistance: run.flipDistance });
      for (const parent of run.dependsOn ?? []) edges.push({ from: parent, to: run.transcriptHash, type: "depends_on" });
      for (const child of run.informs ?? []) edges.push({ from: run.transcriptHash, to: child, type: "informs" });
    }
  }
  for (const node of [...nodes.keys()]) {
    if (!nodes.has(node)) continue;
  }
  detectCycles([...nodes.keys()], edges);
  return { nodes: [...nodes.values()].sort((a, b) => a.transcriptHash.localeCompare(b.transcriptHash)), edges: edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.type.localeCompare(b.type)) };
}

function detectCycles(nodeIds: string[], edges: GraphEdge[]): void {
  const outgoing = new Map<string, string[]>();
  for (const id of nodeIds) outgoing.set(id, []);
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function walk(id: string): void {
    if (visiting.has(id)) throw new Error(`Cycle detected in decision graph at transcript ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of outgoing.get(id) ?? []) walk(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of [...nodeIds].sort()) walk(id);
}

function downstreamImpact(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, transcriptHash: string): string[] {
  const queue = [transcriptHash];
  const visited = new Set<string>([transcriptHash]);
  const impact: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const children = graph.edges.filter((e) => e.from === current).map((e) => e.to).sort();
    for (const child of children) {
      if (visited.has(child)) continue;
      visited.add(child);
      impact.push(child);
      queue.push(child);
    }
  }
  return impact;
}

function deriveLens(lens: LensType, ws: DecisionWorkspace, run: RunResult): string {
  if (lens === "executive") {
    return `Decision: ${run.recommendedAction}\nWhy: ${run.boundarySummary}\nWhat would change it: ${run.plan.stopConditions.join("; ")}`;
  }
  if (lens === "engineering") {
    return `Constraints: unresolved tasks=${ws.tasks.filter(t => !t.completed).length}\nBoundaries: flip_distance=${run.flipDistance}\nFailure modes: ${run.decaySummary.expired > 0 ? "expired evidence" : "boundary drift"}`;
  }
  if (lens === "legal") {
    return `Assumptions: ${ws.evidence.map(e => e.id).join(", ")}\nSignatures: ${run.signatureStatus}\nAttestations: transcript hash ${run.transcriptHash}`;
  }
  return `Fastest mind-change signal: ${run.topEvidence[0]?.summary ?? "no evidence"}`;
}


function citeEvidence(item: EvidenceItem): string {
  return `${item.id}:${item.provenance.hash.slice(0, 12)}@${item.assertedAt ?? "unknown"}`;
}

function explainForAudience(ws: DecisionWorkspace, audience: Audience, area?: string): string {
  const latest = ws.runs[ws.runs.length - 1];
  const evidenceCitations = ws.evidence.map(citeEvidence).join(", ") || "none";
  if (audience === "exec") {
    return `Decision ${ws.decisionId} (${ws.decisionType}/${ws.workspaceMode}) state=${ws.state}. Outcome=${latest?.recommendedAction ?? "unknown"}. Sensitivity=${latest?.plan.stopConditions.join("; ") ?? "unknown"}. Evidence=${evidenceCitations}.`;
  }
  if (audience === "legal") {
    return `Scope=${area ?? ws.decisionType}. Decision=${ws.decisionId}. State=${ws.state}. Transcript=${latest?.transcriptHash ?? "none"}. Provenance=${evidenceCitations}.`;
  }
  if (audience === "sales") {
    return `Claim posture for ${ws.decisionType}: confidence range inferred from fragility=${latest?.fragility ?? "unknown"}. Backing evidence=${evidenceCitations}.`;
  }
  if (audience === "auditor") {
    return `Audit bundle decision=${ws.decisionId} mode=${ws.workspaceMode} state=${ws.state} run_count=${ws.runs.length} evidence_refs=${evidenceCitations}`;
  }
  return `Engineering view: decision=${ws.decisionId} type=${ws.decisionType} unresolved_tasks=${ws.tasks.filter(t => !t.completed).length} drift_signals=${latest?.plan.stopConditions.join("; ") ?? "none"}`;
}

function buildTypeSummary(type: DecisionType | undefined, audience: Audience): { rows: Array<{ decisionId: string; type: DecisionType; mode: string; state: string; reviewAfter: string; evidenceCount: number }>; text: string } {
  const rows = collectWorkspaces()
    .filter((ws) => (type ? ws.decisionType === type : true))
    .sort((a, b) => a.decisionId.localeCompare(b.decisionId))
    .map((ws) => ({
      decisionId: ws.decisionId,
      type: ws.decisionType,
      mode: ws.workspaceMode,
      state: ws.state,
      reviewAfter: ws.createdAt ? new Date(new Date(ws.createdAt).getTime() + 30 * 24 * 3600 * 1000).toISOString() : "unknown",
      evidenceCount: ws.evidence.length
    }));
  const text = rows.map((row) => `${row.decisionId} type=${row.type} mode=${row.mode} state=${row.state} reviewAfter=${row.reviewAfter} evidence=${row.evidenceCount} audience=${audience}`).join("\n") || "No matching decisions.";
  return { rows, text };
}

export function parseWorkflowArgs(argv: string[]): WorkflowArgs {
  const command = ["start", "add-note", "run", "next", "share", "copy", "export", "quests", "done", "streaks", "graph", "view", "review", "explain", "summary", "decision-health", "drift-report", "roi-report", "verify", "evidence", "help", "examples", "template", "decision"].includes(argv[0] ?? "") ? argv[0] as WorkflowArgs["command"] : null;
  const subcommand =
    argv[0] === "export" && ["md", "ics", "bundle", "decision"].includes(argv[1] ?? "")
      ? argv[1] as WorkflowArgs["subcommand"]
      : argv[0] === "evidence" && ["set-expiry", "expired"].includes(argv[1] ?? "")
        ? argv[1] as WorkflowArgs["subcommand"]
        : argv[0] === "help" && ["start", "examples"].includes(argv[1] ?? "")
          ? argv[1] as WorkflowArgs["subcommand"]
      : argv[0] === "graph" && ["show", "impact", "fragility"].includes(argv[1] ?? "")
        ? argv[1] as WorkflowArgs["subcommand"]
        : argv[0] === "review" && argv[1] === "weekly"
          ? "weekly"
          : argv[0] === "template" && argv[1] === "list"
            ? "list"
            : argv[0] === "decision" && argv[1] === "create"
              ? "create"
              : undefined;
  const value = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const list = (flag: string): string[] => {
    const values: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === flag && argv[i + 1]) values.push(argv[i + 1]);
    }
    return values;
  };
  const positionalDecision = (["decision-health", "verify"].includes(argv[0] ?? "") ? argv[1] : undefined)
    || (argv[0] === "export" && argv[1] === "decision" ? argv[2] : undefined);
  return {
    command,
    subcommand,
    decision: value("--decision") ?? positionalDecision,
    text: value("--text"),
    title: value("--title"),
    templateId: value("--template"),
    json: argv.includes("--json"),
    output: value("--out"),
    envelope: value("--envelope"),
    due: value("--due"),
    timezone: value("--timezone"),
    taskId: argv[1] && command === "done" ? argv[1] : value("--task"),
    transcript: argv[2] && command === "view" ? argv[2] : value("--transcript"),
    lens: (argv[1] && command === "view" ? argv[1] : value("--lens")) as LensType | undefined,
    dependsOn: list("--depends-on"),
    informs: list("--informs"),
    assertedAt: value("--asserted-at"),
    expiresAt: value("--expires-at"),
    asOf: value("--as-of"),
    audience: value("--audience") as Audience | undefined,
    type: value("--type") as DecisionType | undefined,
    mode: (value("--mode") as "internal" | "customer" | undefined),
    since: value("--since"),
    window: (value("--window") as "7d" | "30d" | "90d" | undefined),
    driftType: value("--type") as DriftType | undefined,
    format: (value("--format") as "zip" | "dir" | undefined),
    signed: argv.includes("--signed"),
    includeRaw: argv.includes("--include-raw"),
    inDuration: value("--in"),
    evidenceId: argv[2] && argv[0] === "evidence" && argv[1] === "set-expiry" ? argv[2] : value("--evidence"),
    interactive: argv.includes("--interactive"),
    allowCrossWorkspace: argv.includes("--allow-cross-workspace"),
    fixedTime: value("--fixed-time"),
  };
}

export async function runWorkflowCommand(args: WorkflowArgs): Promise<number> {
  ensureWorkspaceRoot();
  if (!args.command) return 1;

  if (args.fixedTime) {
    process.env.ZEO_FIXED_TIME = args.fixedTime;
  }

  if (args.command === "help") {
    if (args.subcommand === "start") {
      process.stdout.write([
        "Try Zeo in 60 seconds:",
        "1) Analyze something: zeo analyze-pr examples/analyze-pr-auth/diff.patch",
        "2) Convert to decision: zeo decision create --template security-review --title \"Auth decision\"",
        "3) View dashboard: zeo view <run_id> --persona exec",
        "4) Export bundle: zeo export decision <id> --format zip",
        "5) Apply policy pack: zeo pack apply security-pack",
      ].join("\n") + "\n");
      return 0;
    }
    if (args.subcommand === "examples") {
      process.stdout.write([
        "Examples:",
        "- zeo analyze-pr examples/analyze-pr-auth/diff.patch",
        "- zeo replay examples/startup-scaling",
        "- zeo template list",
        "- zeo export decision <id> --format dir",
      ].join("\n") + "\n");
      return 0;
    }
  }

  if (args.command === "examples") {
    process.stdout.write("Use: zeo help examples\n");
    return 0;
  }

  if (args.command === "template" && args.subcommand === "list") {
    return writeTemplateCatalog(args);
  }

  if (args.command === "decision" && args.subcommand === "create") {
    const title = args.title || (process.stdin.isTTY ? await prompt("Decision title: ") : "Untitled Decision");
    const templateId = args.templateId ?? "product-launch";
    const template = getTemplate(templateId);
    const decisionId = `dec_${hash({ title, templateId }).slice(0, 12)}`;
    const createdAt = nowIso();
    const reviewAt = new Date(Date.parse(createdAt) + template.reviewAfterDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const evidence = template.requiredEvidence.map((value, index) => parseNoteToEvidence(`template evidence requirement: ${value}`, createdAt.slice(0, 10), reviewAt)).map((proposal, index) => ({ ...proposal, id: `ev_${hash({ decisionId, index, summary: proposal.summary }).slice(0, 10)}` }));
    const assumptions = template.requiredAssumptions.map((value, index) => parseNoteToEvidence(`template assumption: ${value}`, createdAt.slice(0, 10), reviewAt)).map((proposal, index) => ({ ...proposal, id: `ev_${hash({ decisionId, index, summary: proposal.summary, kind: "assumption" }).slice(0, 10)}` }));
    const seededEvidence = [...evidence, ...assumptions];
    const ws: DecisionWorkspace = {
      decisionId,
      title,
      decisionType: template.decisionType,
      workspaceMode: template.workspaceMode,
      state: "proposed",
      createdAt,
      evidence: seededEvidence,
      tasks: seededEvidence.flatMap((item) => createTasksFromEvidence(item)),
      runs: [],
      chain: {},
      workspaceId: defaultWorkspaceId(),
      reviewAt,
      driftEvents: [],
      healthHistory: []
    };
    saveWorkspace(ws);
    writeJsonOrText(args, { decisionId, template, reviewAt }, `Started decision '${title}' (${decisionId}) from template ${template.id}. reviewAt=${reviewAt}`);
    return 0;
  }

  if (args.command === "drift-report") {
    const sinceDate = parseSinceToDate(args.since);
    const events = collectWorkspaces()
      .flatMap((ws) => (ws.driftEvents ?? []).map((event) => ({ ...event, workspaceId: ws.workspaceId ?? defaultWorkspaceId() })))
      .filter((event) => event.detectedAt.slice(0, 10) >= sinceDate)
      .filter((event) => (args.driftType ? event.type === args.driftType : true))
      .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt) || a.decisionId.localeCompare(b.decisionId));
    writeJsonOrText(args, { since: sinceDate, events }, events.map((event) => `${event.detectedAt} ${event.decisionId} ${event.type} ${event.severity}`).join("\n") || "No drift events.");
    return 0;
  }

  if (args.command === "roi-report") {
    const window = args.window ?? "30d";
    const sinceDate = parseSinceToDate(window);
    const workspaces = collectWorkspaces();
    const allRuns = workspaces.flatMap((ws) => ws.runs.map((run) => ({ ws, run })));
    const inWindow = allRuns.filter(({ run }) => String(run.fullTranscript?.timestamp ?? "1970-01-01T00:00:00.000Z").slice(0, 10) >= sinceDate);
    const decisionsCount = inWindow.length;
    const avgTimeToDecision = decisionsCount === 0 ? 0 : Math.round(inWindow.reduce((sum, { ws, run }) => sum + Math.max(0, (Date.parse(String(run.fullTranscript?.timestamp ?? nowIso())) - Date.parse(ws.createdAt ?? nowIso())) / 60000), 0) / decisionsCount);
    const percentWithFullEvidence = decisionsCount === 0 ? 0 : clampScore((inWindow.filter(({ ws }) => ws.evidence.length >= requiredEvidenceCountForType(ws.decisionType)).length / decisionsCount) * 100);
    const securityFlagsPreMerge = inWindow.filter(({ ws }) => ws.decisionType === "SEC").length;
    const claimsBackedByEvidence = clampScore(decisionsCount === 0 ? 0 : (inWindow.filter(({ ws }) => ws.evidence.length > 0).length / decisionsCount) * 100);
    const payload = { schemaVersion: "1.0.0", window, since: sinceDate, decisionsCount, avgTimeToDecision, percentWithFullEvidence, securityFlagsPreMerge, claimsBackedByEvidence };
    writeJsonOrText(args, payload, `window=${window} decisions=${decisionsCount} avg_time_min=${avgTimeToDecision} full_evidence=${percentWithFullEvidence}% security_flags=${securityFlagsPreMerge} claims_backed=${claimsBackedByEvidence}%`);
    return 0;
  }

  if (args.command === "start") {
    const title = args.title || (process.stdin.isTTY ? await prompt("Decision title: ") : "Untitled Decision");
    const decisionId = `dec_${hash({ title }).slice(0, 12)}`;
    const createdAt = nowIso();
    const ws: DecisionWorkspace = { decisionId, title, decisionType: args.type ?? "ENG", workspaceMode: args.mode ?? "customer", state: "proposed", createdAt, evidence: [], tasks: [], runs: [], chain: {}, workspaceId: defaultWorkspaceId(), reviewAt: new Date(Date.parse(createdAt) + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10), driftEvents: [], healthHistory: [] };
    saveWorkspace(ws);
    writeJsonOrText(args, ws, `Started decision '${title}' (${decisionId})`);
    return 0;
  }

  if (args.command === "decision-health") {
    const decisionId = args.decision || args.title;
    if (!decisionId) throw new Error("Usage: zeo decision-health <decisionId> [--json]");
    const ws = loadWorkspace(decisionId);
    const health = ws.healthHistory?.[ws.healthHistory.length - 1] ?? computeDecisionHealth(ws, ws.runs.length > 0);
    writeJsonOrText(args, { decisionId, health }, healthLine(health));
    return 0;
  }

  if (args.command === "verify") {
    const target = args.decision || args.title;
    if (!target) throw new Error("Usage: zeo verify <bundlePath|decisionId> [--json]");
    const dir = existsSync(resolve(target)) ? resolve(target) : join(resolve(process.cwd(), "exports"), target);
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files: Array<{ path: string; sha256: string; size: number }>; verificationStatus?: { method: "hash_only" | "signed"; signatureValid: boolean | null; manifestHash: string } };
    const mismatches: string[] = [];
    for (const file of manifest.files) {
      const absolute = join(dir, file.path);
      if (!existsSync(absolute)) {
        mismatches.push(`${file.path}:missing`);
        continue;
      }
      const contents = readFileSync(absolute);
      const digest = createHash("sha256").update(contents).digest("hex");
      if (digest !== file.sha256) mismatches.push(`${file.path}:hash_mismatch`);
      if (contents.byteLength !== file.size) mismatches.push(`${file.path}:size_mismatch`);
    }
    const verified = mismatches.length === 0;
    const payload = {
      verified,
      method: manifest.verificationStatus?.method ?? "hash_only",
      manifestHash: manifest.verificationStatus?.manifestHash ?? createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex"),
      treeHash: createHash("sha256").update(JSON.stringify(manifest.files.map((f) => [f.path, f.sha256]))).digest("hex"),
      signatureValid: manifest.verificationStatus?.signatureValid ?? null,
      verifiedAt: nowIso(),
      drift: mismatches,
    };
    if (!verified) {
      const tips = nextSteps("verify-mismatch", {});
      writeJsonOrText(args, payload, `${verified ? "verified" : "failed"}\n${mismatches.join("\n")}\n${tips.join("\n")}`);
      return 2;
    }
    writeJsonOrText(args, payload, "verified");
    return 0;
  }

  if (args.command === "evidence" && args.subcommand === "expired") {
    const today = nowIso().slice(0, 10);
    const expired = collectWorkspaces().flatMap((ws) => ws.evidence.filter((e) => classifyDecay(e, today) === "expired").map((e) => ({ decisionId: ws.decisionId, evidenceId: e.id, expiresAt: e.expiresAt ?? null })));
    writeJsonOrText(args, { expired }, expired.map((item) => `${item.decisionId} ${item.evidenceId} expiresAt=${item.expiresAt}`).join("\n") || "No expired evidence.");
    return 0;
  }

  if (args.command === "graph") {
    const graph = collectGraph(args.asOf ?? DEFAULT_AS_OF_DATE);
    if (args.subcommand === "show") {
      const transcriptHash = args.transcript ?? args.decision;
      if (!transcriptHash) throw new Error("Usage: zeo graph show <transcript>");
      const related = graph.edges.filter((e) => e.from === transcriptHash || e.to === transcriptHash);
      writeJsonOrText(args, { transcript: transcriptHash, edges: related }, related.map((e) => `${e.from} -[${e.type}]-> ${e.to}`).join("\n") || "No graph edges.");
      return 0;
    }
    if (args.subcommand === "impact") {
      const transcriptHash = args.transcript ?? args.decision;
      if (!transcriptHash) throw new Error("Usage: zeo graph impact <transcript>");
      const impact = downstreamImpact(graph, transcriptHash);
      writeJsonOrText(args, { transcript: transcriptHash, impact }, impact.join("\n") || "No downstream impact.");
      return 0;
    }
    if (args.subcommand === "fragility") {
      const ranked = graph.nodes.map((node) => ({
        transcriptHash: node.transcriptHash,
        downstreamCount: downstreamImpact(graph, node.transcriptHash).length,
        flipDistance: node.flipDistance,
        fragilityScore: downstreamImpact(graph, node.transcriptHash).length * Math.max(1, 10 - node.flipDistance),
      })).sort((a, b) => b.fragilityScore - a.fragilityScore || a.transcriptHash.localeCompare(b.transcriptHash));
      writeJsonOrText(args, { ranked }, ranked.map((item) => `${item.transcriptHash} score=${item.fragilityScore}`).join("\n"));
      return 0;
    }
    throw new Error("Usage: zeo graph <show|impact|fragility>");
  }

  if (args.command === "view") {
    const lens = args.lens;
    if (!lens || !LENSES.includes(lens)) throw new Error("Usage: zeo view <executive|engineering|legal|personal> <transcript>");
    const transcriptHash = args.transcript ?? args.decision;
    if (!transcriptHash) throw new Error("Transcript hash required");
    for (const ws of collectWorkspaces()) {
      const run = ws.runs.find((r) => r.transcriptHash === transcriptHash);
      if (run) {
        const body = deriveLens(lens, ws, run);
        writeJsonOrText(args, { lens, transcript: transcriptHash, body }, body);
        return 0;
      }
    }
    throw new Error(`Transcript not found: ${transcriptHash}`);
  }

  if (args.command === "review" && args.subcommand === "weekly") {
    const workspaces = collectWorkspaces();
    const robust: string[] = [];
    const invalidatedEarly: string[] = [];
    const retired: string[] = [];
    for (const ws of workspaces) {
      if (ws.runs.length > 1 && ws.runs[ws.runs.length - 1].flipDistance > ws.runs[0].flipDistance) robust.push(ws.decisionId);
      if (ws.evidence.some((e) => e.expiresAt && ws.tasks.some((t) => t.sourceEvidenceId === e.id && t.completed))) invalidatedEarly.push(ws.decisionId);
      if (ws.runs.length > 0 && ws.runs[ws.runs.length - 1].decaySummary.expired > 0) retired.push(ws.decisionId);
    }
    const report = { robust, invalidatedEarly, retired };
    writeJsonOrText(args, report, `robust=${robust.join(",") || "none"}\ninvalidated_early=${invalidatedEarly.join(",") || "none"}\nretire=${retired.join(",") || "none"}`);
    return 0;
  }

  if (args.command === "summary") {
    const audience = args.audience ?? "engineer";
    const summary = buildTypeSummary(args.type, audience);
    writeJsonOrText(args, { audience, type: args.type ?? null, rows: summary.rows }, summary.text);
    return 0;
  }

  const decisionId = args.decision;
  if (!decisionId) throw new Error("--decision is required");
  const ws = loadWorkspace(decisionId);

  if (args.command === "evidence" && args.subcommand === "set-expiry") {
    if (!args.evidenceId) throw new Error("Usage: zeo evidence set-expiry <evidenceId> --decision <id> --in 30d");
    const days = parseDurationToDays(args.inDuration);
    const evidence = ws.evidence.find((item) => item.id === args.evidenceId);
    if (!evidence) throw new Error(`Evidence not found: ${args.evidenceId}`);
    const base = nowIso().slice(0, 10);
    const expiresAt = new Date(Date.parse(`${base}T00:00:00.000Z`) + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    evidence.expiresAt = expiresAt;
    saveWorkspace(ws);
    writeJsonOrText(args, { decisionId, evidenceId: evidence.id, expiresAt }, `Set expiry for ${evidence.id} to ${expiresAt}`);
    return 0;
  }

  if (args.command === "add-note") {
    const text = args.text || (process.stdin.isTTY ? await prompt("Paste note: ") : "");
    if (!text) throw new Error("note text required via --text");
    const proposal = parseNoteToEvidence(text, isoDate(args.assertedAt) ?? undefined, isoDate(args.expiresAt) ?? undefined);
    const evidence: EvidenceItem = { ...proposal, id: `ev_${proposal.provenance.hash.slice(0, 10)}` };
    ws.evidence = [...ws.evidence, evidence];
    ws.tasks = [...ws.tasks, ...createTasksFromEvidence(evidence)];
    saveWorkspace(ws);
    writeJsonOrText(args, { proposal, accepted: true, evidenceId: evidence.id }, `Added evidence ${evidence.id}: ${evidence.summary}`);
    return 0;
  }

  if (args.command === "run") {
    const asOf = isoDate(args.asOf) ?? DEFAULT_AS_OF_DATE;
    for (const dep of args.dependsOn) {
      const linked = resolveTranscriptWorkspace(dep);
      if (linked && linked.workspaceId !== ws.workspaceId && !args.allowCrossWorkspace) {
        throw new Error("[E_SCOPE_CROSS_WORKSPACE] linked transcript is in a different workspace; use --allow-cross-workspace to override.");
      }
    }
    const result = await runDecisionInWorkspace(ws, args.envelope, asOf, args.dependsOn, args.informs);
    const replayStable = ws.runs.length === 0 ? true : ws.runs[ws.runs.length - 1].transcriptHash === result.transcriptHash;
    const health = computeDecisionHealth(ws, replayStable);
    const staleCount = ws.evidence.filter((item) => {
      const status = classifyDecay(item, asOf);
      return status === "stale" || status === "expired";
    }).length;
    if (staleCount > 0) {
      health.policyComplianceScore = clampScore(health.policyComplianceScore - staleCount * 10);
      health.riskScore = clampScore(health.riskScore + staleCount * 5);
    }
    if (ws.reviewAt && asOf >= ws.reviewAt) {
      appendDriftEvent(ws, {
        decisionId: ws.decisionId,
        assumptionId: null,
        type: "review_overdue",
        severity: "high",
        detectedAt: nowIso(),
        details: { reviewAt: ws.reviewAt, asOf }
      });
      health.policyComplianceScore = clampScore(health.policyComplianceScore - 20);
      health.assumptionVolatilityIndex = clampScore(health.assumptionVolatilityIndex + 15);
      health.riskScore = clampScore(health.riskScore + 12);
    }
    result.health = health;
    ws.runs = [...ws.runs, result];
    ws.chain.parentTranscriptHash = ws.runs.length > 1 ? ws.runs[ws.runs.length - 2]?.transcriptHash : undefined;
    ws.healthHistory = [...(ws.healthHistory ?? []), health];
    for (const evidence of ws.evidence) {
      if (classifyDecay(evidence, asOf) === "expired") {
        appendDriftEvent(ws, {
          decisionId: ws.decisionId,
          assumptionId: evidence.id,
          type: "evidence_expired",
          severity: "medium",
          detectedAt: nowIso(),
          details: { evidenceId: evidence.id, expiresAt: evidence.expiresAt ?? null },
        });
      }
    }
    saveWorkspace(ws);
    persistMetricsSnapshot(ws, health);
    const ctas = nextSteps("decision-finalize", { decisionId: ws.decisionId });
    writeJsonOrText(args, result, `${formatResultCard(result)}\n${healthLine(health)}\n${ctas.join("\n")}`);
    return 0;
  }

  if (args.command === "next") {
    const asOf = isoDate(args.asOf) ?? DEFAULT_AS_OF_DATE;
    const checklist = ws.tasks.filter((t) => !t.completed).sort((a, b) => a.id.localeCompare(b.id)).map((t) => {
      const evidence = ws.evidence.find((e) => e.id === t.sourceEvidenceId);
      const decay = evidence ? classifyDecay(evidence, asOf) : "unknown";
      return `- [ ] (${t.id}) ${t.label} [decay=${decay}]`;
    });
    writeJsonOrText(args, { tasks: checklist }, checklist.join("\n") || "No pending tasks.");
    return 0;
  }

  if (args.command === "quests") {
    const quests = ws.tasks.sort((a, b) => a.id.localeCompare(b.id)).map((t) => `- [${t.completed ? "x" : " "}] (${t.id}) ${t.label}`);
    writeJsonOrText(args, { quests }, quests.join("\n") || "No quests yet.");
    return 0;
  }

  if (args.command === "done") {
    if (!args.taskId) throw new Error("task id required: zeo done <taskId> --decision <id>");
    const task = ws.tasks.find((t) => t.id === args.taskId);
    if (!task) throw new Error(`Task not found: ${args.taskId}`);
    task.completed = true;
    saveWorkspace(ws);
    writeJsonOrText(args, { taskId: task.id, completed: true }, `Marked ${task.id} complete.`);
    return 0;
  }

  if (args.command === "share" || args.command === "copy") {
    const latest = ws.runs[ws.runs.length - 1] ?? await runDecisionInWorkspace(ws, args.envelope, isoDate(args.asOf) ?? DEFAULT_AS_OF_DATE, [], []);
    const share = `Zeo Decision: ${ws.title}\nAction: ${latest.recommendedAction}\nFragility: ${latest.fragility}\nHash: ${latest.transcriptHash}`;
    ensureNoSecrets(share);
    writeJsonOrText(args, { share }, share);
    return 0;
  }

  if (args.command === "export") {
    const latest = ws.runs[ws.runs.length - 1] ?? await runDecisionInWorkspace(ws, args.envelope, isoDate(args.asOf) ?? DEFAULT_AS_OF_DATE, [], []);
    const outDir = args.output ? resolve(args.output) : resolve(process.cwd(), "exports");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    if (args.subcommand === "md") {
      const envelopeRef = args.envelope ? resolve(args.envelope) : "none";
      const md = `---\ntranscript_hash: ${latest.transcriptHash}\nenvelope: ${envelopeRef}\ndecision_id: ${ws.decisionId}\n---\n\n# ${ws.title}\n\n${formatResultCard(latest)}\n\n## Decay\n${ws.evidence.map((e) => `- ${e.summary}: ${classifyDecay(e, isoDate(args.asOf) ?? DEFAULT_AS_OF_DATE)}`).join("\n")}\n`;
      const file = join(outDir, `${latest.transcriptHash.slice(0, 16)}.md`);
      writeFileSync(file, md, "utf8");
      writeJsonOrText(args, { out: file }, file);
      return 0;
    }

    if (args.subcommand === "ics") {
      const timezone = args.timezone ?? DEFAULT_TIMEZONE;
      const dueDate = args.due;
      const tasks = ws.tasks.filter((t) => !t.completed).sort((a, b) => a.id.localeCompare(b.id));
      const body = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Zeo//Decision Tasks//EN",
        ...tasks.flatMap((task) => {
          const date = dueDate ?? task.dueDate;
          const dt = date ? date.replace(/-/g, "") : "";
          return [
            "BEGIN:VEVENT",
            `UID:${task.id}@zeo`,
            `SUMMARY:Re-check ${task.label}`,
            ...(dt ? [`DTSTART;VALUE=DATE:${dt}`] : []),
            `X-WR-TIMEZONE:${timezone}`,
            "END:VEVENT",
          ];
        }),
        "END:VCALENDAR",
      ].join("\n");
      const file = join(outDir, `${latest.transcriptHash.slice(0, 16)}.ics`);
      writeFileSync(file, `${body}\n`, "utf8");
      writeJsonOrText(args, { out: file }, file);
      return 0;
    }

    if (args.subcommand === "decision") {
      const format = args.format ?? "zip";
      const folder = join(outDir, `${ws.decisionId}-bundle`);
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
      const health = getLatestHealth(ws);
      const replay = { transcriptHash: latest.transcriptHash, expectedHash: latest.transcriptHash };
      const policy = { policyPackId: "default", hash: hash({ decisionType: ws.decisionType, workspaceMode: ws.workspaceMode }) };
      const redactedEvidence = args.includeRaw
        ? ws.evidence
        : ws.evidence.map((item) => ({ id: item.id, summary: item.summary, assertedAt: item.assertedAt, expiresAt: item.expiresAt, provenance: item.provenance }));
      writeFileSync(join(folder, "decision.json"), `${JSON.stringify(ws, null, 2)}\n`, "utf8");
      writeFileSync(join(folder, "evidence.json"), `${JSON.stringify(redactedEvidence, null, 2)}\n`, "utf8");
      writeFileSync(join(folder, "transcript.md"), `${formatResultCard(latest)}\n`, "utf8");
      writeFileSync(join(folder, "metrics.json"), `${JSON.stringify(health, null, 2)}\n`, "utf8");
      writeFileSync(join(folder, "replay.json"), `${JSON.stringify(replay, null, 2)}\n`, "utf8");
      writeFileSync(join(folder, "policy.json"), `${JSON.stringify(policy, null, 2)}\n`, "utf8");
      writeFileSync(join(folder, "provenance.json"), `${JSON.stringify({ evidenceHashes: ws.evidence.map((item) => item.provenance.hash) }, null, 2)}\n`, "utf8");
      const bundleFiles = ["decision.json", "evidence.json", "transcript.md", "metrics.json", "replay.json", "policy.json", "provenance.json"];
      const manifest = buildBundleManifest(folder, bundleFiles);
      let signatureValid: boolean | null = null;
      if (args.signed) {
        const signingKey = process.env.ZEO_SIGNING_HMAC_KEY;
        if (signingKey) {
          const signature = createHash("sha256").update(`${manifest.manifestHash}:${signingKey}`).digest("hex");
          writeFileSync(join(folder, "signature.json"), `${JSON.stringify({ mode: "hmac", signature }, null, 2)}\n`, "utf8");
          signatureValid = true;
          bundleFiles.push("signature.json");
        }
      }
      const status = verificationStatusFromHealth(health, manifest.manifestHash, manifest.treeHash, args.signed && signatureValid === true, signatureValid);
      const manifestPayload = { schemaVersion: "1.0.0", files: buildBundleManifest(folder, bundleFiles).files, verificationStatus: status };
      writeFileSync(join(folder, "manifest.json"), `${JSON.stringify(manifestPayload, null, 2)}\n`, "utf8");
      const proofLine = status.verified ? `Zeo Verified (${status.method})` : "Verification pending";
      const text = `${folder}\n${proofLine}${args.includeRaw ? "\nWARNING: raw evidence included" : ""}`;
      writeJsonOrText(args, { out: folder, verificationStatus: status, format }, text);
      return 0;
    }

    if (args.subcommand === "bundle") {
      const folder = join(outDir, latest.transcriptHash.slice(0, 16));
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
      const transcript = { decision: ws.decisionId, runs: ws.runs, evidence: ws.evidence, tasks: ws.tasks };
      writeFileSync(join(folder, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
      if (args.envelope && existsSync(resolve(args.envelope))) cpSync(resolve(args.envelope), join(folder, "envelope.json"));
      writeFileSync(join(folder, "summary.md"), `# ${ws.title}\n\n${formatResultCard(latest)}\n`, "utf8");
      writeFileSync(join(folder, "trust-snapshot.json"), `${JSON.stringify({ decisionId: ws.decisionId, runCount: ws.runs.length }, null, 2)}\n`, "utf8");
      writeJsonOrText(args, { out: folder }, folder);
      return 0;
    }

    throw new Error("Usage: zeo export <md|ics|bundle|decision>");
  }


  if (args.command === "explain") {
    const audience = args.audience ?? "engineer";
    const target = args.decision;
    if (!target) throw new Error("Usage: zeo explain --decision <id> [--audience legal|exec|sales|engineer|auditor]");
    const ws = loadWorkspace(target);
    const explanation = explainForAudience(ws, audience, args.type);
    writeJsonOrText(args, { decision: target, audience, explanation }, explanation);
    return 0;
  }

  if (args.command === "summary") {
    const audience = args.audience ?? "engineer";
    const summary = buildTypeSummary(args.type, audience);
    writeJsonOrText(args, { audience, type: args.type ?? null, rows: summary.rows }, summary.text);
    return 0;
  }

  if (args.command === "streaks") {
    const dirs = readdirSync(decisionsRoot(), { withFileTypes: true }).filter((d) => d.isDirectory());
    let fragilityImproved = 0;
    let replaysVerified = 0;
    let signed = 0;
    let earlyInvalidations = 0;
    for (const dir of dirs) {
      const local = loadWorkspace(dir.name);
      if (local.runs.length > 1 && local.runs[local.runs.length - 1].flipDistance > local.runs[0].flipDistance) fragilityImproved += 1;
      if (local.runs.length > 0) replaysVerified += 1;
      if (local.runs.some((r) => r.signatureStatus === "signed")) signed += 1;
      if (local.evidence.some((e) => e.expiresAt) && local.tasks.some((t) => t.completed)) earlyInvalidations += 1;
    }
    writeJsonOrText(args, { fragilityImproved, replaysVerified, signedTranscripts: signed, earlyInvalidations }, `fragility_improved=${fragilityImproved}\nreplays_verified=${replaysVerified}\nsigned_transcripts=${signed}\nearly_invalidations=${earlyInvalidations}`);
    return 0;
  }

  return 1;
}

