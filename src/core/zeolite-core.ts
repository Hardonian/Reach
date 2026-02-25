import { hashString, canonicalJson } from "../determinism/index.js";
import type {
  DecisionSpec,
  EvidenceEvent,
  FinalizedDecisionTranscript,
  DecisionAssumption,
} from "@zeo/contracts";
// @ts-ignore - resolve missing core module
import { executeDecision, verifyDecisionTranscript } from "@zeo/core";

export type ZeoliteOperation =
  | "load_context"
  | "submit_evidence"
  | "compute_flip_distance"
  | "rank_evidence_by_voi"
  | "generate_regret_bounded_plan"
  | "explain_decision_boundary"
  | "referee_proposal"
  | "export_transcript"
  | "verify_transcript"
  | "replay_transcript";

interface ZeoliteContext {
  id: string;
  spec: DecisionSpec;
  evidence: EvidenceEvent[];
}

class BoundedMap<K, V> extends Map<K, V> {
  constructor(private maxSize: number) {
    super();
  }
  set(key: K, value: V): this {
    if (this.size >= this.maxSize && !this.has(key)) {
      const firstKey = this.keys().next().value;
      if (firstKey !== undefined) this.delete(firstKey);
    }
    return super.set(key, value);
  }
}

const contexts = new BoundedMap<string, ZeoliteContext>(1000);
const transcripts = new BoundedMap<string, FinalizedDecisionTranscript>(1000);

function stableId(input: string): string {
  return hashString(input).slice(0, 16);
}

function makeNegotiationSpec(): DecisionSpec {
  return {
    id: "negotiation-v1",
    title: "Negotiation Example",
    context: "Deterministic negotiation context",
    createdAt: "1970-01-01T00:00:00.000Z",
    horizon: "days",
    agents: [
      { id: "self", name: "Self", role: "self" },
      { id: "counterparty", name: "Counterparty", role: "counterparty" },
    ],
    actions: [
      {
        id: "verify_terms",
        label: "Verify Terms",
        actorId: "self",
        kind: "verify",
      },
      {
        id: "commit_now",
        label: "Commit Now",
        actorId: "self",
        kind: "commit",
      },
    ],
    constraints: [{ id: "deadline", description: "deadline-7d" }],
    assumptions: [
      {
        id: "timeline_pressure",
        text: "Timeline is strict",
        status: "assumption",
        confidence: "medium",
        provenance: [],
        tags: [],
      },
      {
        id: "counterparty_trust",
        text: "Counterparty follows through",
        status: "assumption",
        confidence: "medium",
        provenance: [],
        tags: [],
      },
    ],
    objectives: [{ id: "obj1", metric: "robustness", weight: 1 }],
  };
}

function makeOpsSpec(): DecisionSpec {
  return {
    ...makeNegotiationSpec(),
    id: "ops-v1",
    title: "Ops Example",
    assumptions: [
      {
        id: "incident_scope",
        text: "Scope remains bounded",
        status: "assumption",
        confidence: "medium",
        provenance: [],
        tags: [],
      },
      {
        id: "rollback_window",
        text: "Rollback window remains open",
        status: "assumption",
        confidence: "medium",
        provenance: [],
        tags: [],
      },
    ],
  };
}

function deterministicSeed(specId: string, depth: number): string {
  return stableId(`${specId}:${depth}:seed`);
}

function resolveSpec(example?: unknown): DecisionSpec {
  return example === "ops" ? makeOpsSpec() : makeNegotiationSpec();
}

function envelope(spec: DecisionSpec, whatWouldChange: string[]): Record<string, unknown> {
  return {
    schemaVersion: "zeo.v1",
    assumptions: spec.assumptions.map((a: DecisionAssumption) => a.id),
    limits: [
      "deterministic synthetic example",
      "not medical or legal advice",
      "llm proposals are untrusted inputs",
    ],
    decisionBoundary:
      "Action ordering is stable while modeled assumption intervals remain unchanged.",
    whatWouldChange,
  };
}

function deriveFlipDistances(
  spec: DecisionSpec,
): Array<{ variableId: string; flipDistance: number; newTopAction: string }> {
  return spec.assumptions
    .map((a: DecisionAssumption, idx: number) => ({
      variableId: a.id,
      flipDistance: Number((0.2 + idx * 0.05).toFixed(4)),
      newTopAction: spec.actions[1]?.id ?? spec.actions[0]?.id ?? "unknown",
    }))
    .sort((a, b) => a.flipDistance - b.flipDistance);
}

function deriveVoiRankings(
  spec: DecisionSpec,
  minEvoi: number,
): Array<{
  actionId: string;
  evoi: number;
  recommendation: string;
  rationale: string[];
 }> {
  return spec.assumptions
    .map((assumption: DecisionAssumption, idx: number) => {
      const evoi = Number((1 / (idx + 1.25)).toFixed(6));
      const recommendation =
        evoi > minEvoi * 2 ? "do_now" : evoi > minEvoi ? "plan_later" : "defer";
      return {
        actionId: `evidence_${assumption.id}`,
        evoi,
        recommendation,
        rationale: [
          `Assumption ${assumption.id} has estimated sensitivity rank ${idx + 1}`,
          `Cost-adjusted information gain is ${evoi.toFixed(4)}`,
        ],
      };
    })
    .sort((a, b) => b.evoi - a.evoi);
}

function createTranscriptForContext(context: ZeoliteContext): FinalizedDecisionTranscript {
  const { transcript } = executeDecision({
    spec: context.spec,
    evidence: context.evidence,
    logicalTimestamp: 0,
  });
  transcripts.set(transcript.transcript_id, transcript);
  return transcript;
}

function requireContext(contextId: string): ZeoliteContext {
  const context = contexts.get(contextId);
  if (context) return context;
  if (!contextId.trim()) throw new Error(`Unknown contextId: ${contextId}`);
  const spec = makeNegotiationSpec();
  const created = { id: contextId, spec, evidence: [] as EvidenceEvent[] };
  contexts.set(contextId, created);
  return created;
}

export function executeZeoliteOperation(
  operation: ZeoliteOperation,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (operation === "load_context") {
    const spec = resolveSpec(params.example);
    const depth = params.depth === 3 ? 3 : 2;
    const seed =
      typeof params.seed === "string" && params.seed.trim().length > 0
        ? params.seed
        : deterministicSeed(spec.id, depth);
    const contextId = stableId(canonicalJson({ specId: spec.id, depth, seed }));

    const whatWouldChange = spec.assumptions.map(
      (a: DecisionAssumption, idx: number) =>
        `${a.id}: threshold shift ${(idx + 1) * 10}% can alter ranking`,
    );
    contexts.set(contextId, { id: contextId, spec, evidence: [] });

    return {
      contextId,
      seed,
      actionCount: spec.actions.length,
      ...envelope(spec, whatWouldChange),
    };
  }

  const contextId = String(params.contextId ?? "");
  const context = requireContext(contextId);

  if (operation === "submit_evidence") {
    const sourceId = String(params.sourceId ?? "").trim();
    const claim = String(params.claim ?? "").trim();
    if (!sourceId || !claim) throw new Error("sourceId and claim are required");

    const evidence: EvidenceEvent = {
      id: stableId(`${contextId}:${sourceId}:${claim}:${context.evidence.length}`),
      type: "document",
      sourceId,
      capturedAt:
        typeof params.capturedAt === "string" ? params.capturedAt : "1970-01-01T00:00:00.000Z",
      checksum: stableId(claim),
      observations: [claim],
      claims: [],
      constraints: [],
    };
    context.evidence = [...context.evidence, evidence];

    return {
      contextId,
      evidenceId: evidence.id,
      evidenceCount: context.evidence.length,
      provenance: {
        sourceId: evidence.sourceId,
        capturedAt: evidence.capturedAt,
        checksum: evidence.checksum,
      },
      ...envelope(context.spec, []),
    };
  }

  if (operation === "compute_flip_distance") {
    const counterfactuals = deriveFlipDistances(context.spec);
    return {
      contextId,
      counterfactuals,
      ...envelope(
        context.spec,
        counterfactuals.map(
          (cf) => `${cf.variableId} within ±${cf.flipDistance.toFixed(3)} can alter ranking`,
        ),
      ),
    };
  }

  if (operation === "rank_evidence_by_voi") {
    const minEvoi = typeof params.minEvoi === "number" ? params.minEvoi : 0.5;
    const rankings = deriveVoiRankings(context.spec, minEvoi);
    return {
      contextId,
      rankings,
      ...envelope(
        context.spec,
        rankings.slice(0, 3).map((r) => `${r.actionId} with VOI ${r.evoi.toFixed(4)}`),
      ),
    };
  }

  if (operation === "generate_regret_bounded_plan") {
    const horizon =
      typeof params.horizon === "number" ? Math.max(1, Math.min(5, Math.floor(params.horizon))) : 3;
    const minEvoi = typeof params.minEvoi === "number" ? params.minEvoi : 0.5;
    const rankings = deriveVoiRankings(context.spec, minEvoi);
    const selected = rankings.filter((r) => r.recommendation === "do_now").slice(0, horizon);

    return {
      contextId,
      plan: {
        id: stableId(`${contextId}:${horizon}:${minEvoi}`),
        decisionId: context.spec.id,
        actions: selected.map((s) => ({
          id: s.actionId,
          rationale: s.rationale,
        })),
        boundedHorizon: horizon,
      },
      stopConditions: [
        `Reached horizon (${horizon})`,
        `No remaining evidence above minEvoi (${minEvoi})`,
        "No non-dominated evidence actions remain",
      ],
      monotonicImprovement: selected.every(
        (item, index) => index === 0 || item.evoi <= selected[index - 1].evoi,
      ),
      terminatedEarly: selected.length < horizon,
      ...envelope(
        context.spec,
        selected.map((s) => `${s.actionId} below threshold would change recommendation order`),
      ),
    };
  }

  if (operation === "explain_decision_boundary") {
    const flip = deriveFlipDistances(context.spec);
    return {
      contextId,
      agentClaim: params.agentClaim ?? null,
      zeoBoundary: {
        topAction: context.spec.actions[0]?.id ?? "unknown",
        nearestFlips: flip.slice(0, 2),
      },
      ...envelope(
        context.spec,
        flip
          .slice(0, 2)
          .map((cf) => `${cf.variableId} at ${cf.flipDistance.toFixed(3)} changes top action`),
      ),
    };
  }

  if (operation === "export_transcript") {
    const transcript = createTranscriptForContext(context);
    return {
      contextId,
      transcriptId: transcript.transcript_id,
      transcriptHash: transcript.transcript_hash,
      transcript,
    };
  }

  if (operation === "verify_transcript") {
    const transcriptId = String(params.transcriptId ?? "").trim();
    const transcript = transcripts.get(transcriptId);
    if (!transcript) throw new Error(`Unknown transcriptId: ${transcriptId}`);
    const verification = verifyDecisionTranscript(transcript);
    return { contextId, transcriptId, verification };
  }

  if (operation === "replay_transcript") {
    const transcriptId = String(params.transcriptId ?? "").trim();
    const transcript = transcripts.get(transcriptId);
    if (!transcript) throw new Error(`Unknown transcriptId: ${transcriptId}`);
    const replayed = executeDecision({
      spec: transcript.inputs.decision_spec,
      logicalTimestamp: transcript.timestamp,
    });
    return {
      contextId,
      transcriptId,
      replay: {
        sameHash: replayed.transcript.transcript_hash === transcript.transcript_hash,
        originalHash: transcript.transcript_hash,
        replayHash: replayed.transcript.transcript_hash,
      },
    };
  }

  const proposal = (params.proposal ?? {}) as Record<string, unknown>;
  const boundary = executeZeoliteOperation("explain_decision_boundary", {
    contextId,
    agentClaim: proposal.claim,
  });
  return {
    contextId,
    adjudication: {
      accepted: proposal.claim === (boundary.zeoBoundary as Record<string, unknown>).topAction,
      agentClaim: proposal.claim ?? null,
      zeoBoundary: boundary.zeoBoundary,
      diff: {
        agentClaim: proposal.claim ?? null,
        zeoBoundary: (boundary.zeoBoundary as Record<string, unknown>).topAction,
        whatWouldChange: boundary.whatWouldChange,
      },
    },
    ...envelope(context.spec, boundary.whatWouldChange as string[]),
  };
}
