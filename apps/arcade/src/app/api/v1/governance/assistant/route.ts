import { NextRequest, NextResponse } from "next/server";
import { auditLog, cloudErrorResponse, requireAuth, requireRole } from "@/lib/cloud-auth";
import {
  createGovernanceArtifact,
  createGovernanceSpec,
  getLatestGovernanceSpec,
  listGovernanceMemory,
  upsertGovernanceMemory,
} from "@/lib/cloud-db";
import { GovernanceAssistantSchema, parseBody } from "@/lib/cloud-schemas";
import {
  buildMemorySeed,
  compileGovernanceIntent,
  type GovernanceMemoryEntry,
  type GovernanceSpec,
} from "@/lib/governance/compiler";
import { generateGovernanceArtifacts, GOVERNANCE_CODEGEN_ENGINE } from "@/lib/governance/codegen";
import { diffGovernanceSpec } from "@/lib/governance/diff";
import { validateGovernanceApplyGuard } from "@/lib/governance/apply-guard";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

function toCompilerMemory(
  records: ReturnType<typeof listGovernanceMemory>,
): GovernanceMemoryEntry[] {
  return records.map((record) => ({
    id: record.id,
    orgId: record.org_id,
    workspaceId: record.workspace_id,
    scope: record.scope,
    memoryType: record.memory_type,
    content: record.content,
    confidence: record.confidence,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
}

function asGovernanceSpec(value: Record<string, unknown>): GovernanceSpec | null {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray(value.gates) || !Array.isArray(value.thresholds)) return null;
  if (value.rolloutMode !== "dry-run" && value.rolloutMode !== "enforced") return null;
  return value as GovernanceSpec;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(GovernanceAssistantSchema, body);
    if ("errors" in parsed) {
      return governanceError(
        parsed.errors.issues[0]?.message ?? "Invalid request",
        400,
        "GOV_ASSISTANT_INVALID_REQUEST",
      );
    }

    const payload = parsed.data;
    const memory = toCompilerMemory(
      listGovernanceMemory(ctx.tenantId, payload.workspace_id, payload.scope),
    );

    const compiled = compileGovernanceIntent({
      intent: payload.intent,
      orgId: ctx.tenantId,
      workspaceId: payload.workspace_id,
      scope: payload.scope,
      memory,
      defaultRolloutMode: "dry-run",
      forceRolloutMode: payload.rollout_mode,
    });

    const latest = getLatestGovernanceSpec(ctx.tenantId, payload.workspace_id, payload.scope);
    const latestSpec = latest ? asGovernanceSpec(latest.spec) : null;
    const diff = diffGovernanceSpec(latestSpec, compiled.spec);

    const generated = generateGovernanceArtifacts({
      intent: payload.intent,
      spec: compiled.spec,
      specHash: compiled.specHash,
      ciEnforcement: compiled.ciEnforcement,
    });

    const previewArtifacts = generated.artifacts.map((artifact) => ({
      type: artifact.artifactType,
      path: artifact.path,
      hash: artifact.hash,
      output_hash: artifact.outputHash,
      spec_hash: compiled.specHash,
      engine_name: artifact.engine.name,
      engine_version: artifact.engine.version,
    }));

    const preview = {
      plan: compiled.plan,
      spec: compiled.spec,
      spec_hash: compiled.specHash,
      ci_enforcement: compiled.ciEnforcement,
      impact_preview: compiled.impactPreview,
      explainability: generated.explainability,
      diff,
      artifacts: previewArtifacts,
      rollout_mode: compiled.spec.rolloutMode,
      source_intent: payload.intent,
      codegen_engine: GOVERNANCE_CODEGEN_ENGINE,
    };

    if (payload.action === "preview") {
      return NextResponse.json({
        mode: "preview",
        applied: false,
        ...preview,
      });
    }

    const applyGuardError = validateGovernanceApplyGuard({
      action: payload.action,
      compiledSpecHash: compiled.specHash,
      previewSpecHash: payload.preview_spec_hash,
    });
    if (applyGuardError) {
      return governanceError(
        applyGuardError.message,
        409,
        applyGuardError.code,
        applyGuardError.hint,
      );
    }

    if (!requireRole(ctx, "admin")) {
      return governanceError(
        "Applying governance specs requires admin role",
        403,
        "GOV_APPLY_ADMIN_REQUIRED",
      );
    }

    const specRecord = createGovernanceSpec({
      orgId: ctx.tenantId,
      workspaceId: payload.workspace_id,
      scope: payload.scope,
      sourceIntent: payload.intent,
      governancePlan: compiled.plan as unknown as Record<string, unknown>,
      spec: compiled.spec as unknown as Record<string, unknown>,
      specHash: compiled.specHash,
      rolloutMode: compiled.spec.rolloutMode,
      riskSummary: generated.explainability.riskImpactSummary,
      triggeredBy: payload.trigger,
      actorUserId: ctx.userId,
    });

    const artifactRecords = generated.artifacts.map((artifact) =>
      createGovernanceArtifact({
        orgId: ctx.tenantId,
        workspaceId: payload.workspace_id,
        specId: specRecord.id,
        artifactType: artifact.artifactType,
        artifactPath: artifact.path,
        contentText: artifact.content,
        contentHash: artifact.hash,
        sourceIntent: payload.intent,
        governancePlan: compiled.plan as unknown as Record<string, unknown>,
        specHash: compiled.specHash,
        outputHash: artifact.outputHash,
        engineName: artifact.engine.name,
        engineVersion: artifact.engine.version,
        actorType: "user",
        actorUserId: ctx.userId,
        triggeredBy: payload.trigger,
      }),
    );

    const appliedArtifacts = previewArtifacts.map((artifact, index) => {
      const artifactRecord = artifactRecords[index];
      return {
        ...artifact,
        id: artifactRecord?.id,
        link: artifactRecord ? `/api/v1/governance/artifacts/${artifactRecord.id}` : null,
      };
    });

    for (const seed of buildMemorySeed({
      orgId: ctx.tenantId,
      workspaceId: payload.workspace_id,
      scope: payload.scope,
      spec: compiled.spec,
    })) {
      upsertGovernanceMemory({
        orgId: seed.orgId,
        workspaceId: seed.workspaceId,
        scope: seed.scope,
        memoryType: seed.memoryType,
        content: seed.content,
        confidence: seed.confidence,
      });
    }

    auditLog(
      ctx,
      "governance.spec.apply",
      "governance_spec",
      specRecord.id,
      {
        workspace_id: payload.workspace_id,
        scope: payload.scope,
        spec_hash: compiled.specHash,
        diff,
      },
      req,
    );

    return NextResponse.json({
      mode: "apply",
      applied: true,
      spec_id: specRecord.id,
      spec_version: specRecord.version,
      replay_link: specRecord.replay_link,
      artifact_ids: artifactRecords.map((artifact) => artifact.id),
      ...preview,
      artifacts: appliedArtifacts,
    });
  } catch {
    return governanceError(
      "Governance assistant is temporarily unavailable",
      503,
      "GOV_ASSISTANT_UNAVAILABLE",
      "Try preview mode again. If this persists, verify cloud DB configuration.",
    );
  }
}
