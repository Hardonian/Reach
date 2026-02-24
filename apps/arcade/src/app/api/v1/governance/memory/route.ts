import { NextRequest, NextResponse } from "next/server";
import { auditLog, cloudErrorResponse, requireAuth, requireRole } from "@/lib/cloud-auth";
import { listGovernanceMemory, upsertGovernanceMemory } from "@/lib/cloud-db";
import { GovernanceMemorySchema, GovernanceScopeSchema, parseBody } from "@/lib/cloud-schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") ?? "default";
    const scopeResult = GovernanceScopeSchema.safeParse(req.nextUrl.searchParams.get("scope") ?? "project");
    if (!scopeResult.success) {
      return cloudErrorResponse(scopeResult.error.issues[0]?.message ?? "Invalid scope", 400);
    }

    const memory = listGovernanceMemory(ctx.tenantId, workspaceId, scopeResult.data);
    return NextResponse.json({
      workspace_id: workspaceId,
      scope: scopeResult.data,
      memory,
    });
  } catch {
    return cloudErrorResponse("Governance memory unavailable", 503);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!requireRole(ctx, "admin")) {
    return cloudErrorResponse("Admin role required to update governance memory", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(GovernanceMemorySchema, body);
    if ("errors" in parsed) {
      return cloudErrorResponse(parsed.errors.issues[0]?.message ?? "Invalid memory payload", 400);
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
      },
      req,
    );

    return NextResponse.json({
      memory,
    });
  } catch {
    return cloudErrorResponse("Governance memory unavailable", 503);
  }
}
