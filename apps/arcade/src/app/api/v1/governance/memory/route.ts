import { NextRequest, NextResponse } from "next/server";
import { auditLog, cloudErrorResponse, requireAuth, requireRole } from "@/lib/cloud-auth";
import { listGovernanceMemory, upsertGovernanceMemory } from "@/lib/cloud-db";
import { GovernanceMemorySchema, GovernanceScopeSchema, parseBody } from "@/lib/cloud-schemas";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") ?? "default";
    const scopeResult = GovernanceScopeSchema.safeParse(
      req.nextUrl.searchParams.get("scope") ?? "project",
    );
    if (!scopeResult.success) {
      return governanceError(
        scopeResult.error.issues[0]?.message ?? "Invalid scope",
        400,
        "GOV_MEMORY_INVALID_SCOPE",
      );
    }

    const memory = listGovernanceMemory(ctx.tenantId, workspaceId, scopeResult.data);
    return NextResponse.json({
      workspace_id: workspaceId,
      scope: scopeResult.data,
      memory,
    });
  } catch (err) {
    logger.warn("Governance memory read failed", {
      tenant_id: ctx.tenantId,
      err: String(err),
    });
    return governanceError(
      "Governance memory unavailable",
      503,
      "GOV_MEMORY_UNAVAILABLE",
      "Verify cloud configuration and try again.",
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!requireRole(ctx, "admin")) {
    return governanceError(
      "Admin role required to update governance memory",
      403,
      "GOV_MEMORY_ADMIN_REQUIRED",
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(GovernanceMemorySchema, body);
    if ("errors" in parsed) {
      return governanceError(
        parsed.errors.issues[0]?.message ?? "Invalid memory payload",
        400,
        "GOV_MEMORY_INVALID_PAYLOAD",
      );
    }

    const payload = parsed.data;
    const memory = upsertGovernanceMemory({
      orgId: ctx.tenantId,
      workspaceId: payload.workspace_id,
      scope: payload.scope,
      memoryType: payload.memory_type,
      content: payload.content,
      confidence: payload.confidence,
    });

    auditLog(
      ctx,
      "governance.memory.upsert",
      "governance_memory",
      memory.id,
      {
        workspace_id: payload.workspace_id,
        scope: payload.scope,
        memory_type: payload.memory_type,
        repo: req.headers.get("x-reach-repo") ?? undefined,
        branch: req.headers.get("x-reach-branch") ?? undefined,
        run_id: req.headers.get("x-reach-run-id") ?? undefined,
      },
      req,
    );

    return NextResponse.json({
      memory,
    });
  } catch (err) {
    logger.warn("Governance memory write failed", {
      tenant_id: ctx.tenantId,
      err: String(err),
    });
    return governanceError(
      "Governance memory unavailable",
      503,
      "GOV_MEMORY_UNAVAILABLE",
      "Verify cloud configuration and try again.",
    );
  }
}
