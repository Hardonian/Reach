import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from '@/lib/cloud-auth';
import { createProject, listProjects } from '@/lib/cloud-db';
import { CreateProjectSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  const projects = listProjects(ctx.tenantId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, 'member')) return cloudErrorResponse('Insufficient permissions', 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(CreateProjectSchema, body);
  if ('errors' in parsed) return cloudErrorResponse(parsed.firstMessage, 400);

  const project = createProject(ctx.tenantId, parsed.data.name, parsed.data.description);
  auditLog(ctx, 'project.create', 'project', project.id, { name: project.name }, req);
  return NextResponse.json({ project }, { status: 201 });
}
