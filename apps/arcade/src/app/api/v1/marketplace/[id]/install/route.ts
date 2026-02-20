import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, auditLog } from '@/lib/cloud-auth';
import { getPack, getPackBySlug, getPackVersion, incrementDownload } from '@/lib/cloud-db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const pack = getPackBySlug(id) ?? getPack(id);
  if (!pack) return cloudErrorResponse('Pack not found', 404);

  // Reject flagged packs from installation
  if (pack.flagged === 1) {
    return cloudErrorResponse('This pack has been flagged for review and cannot be installed', 403);
  }

  const body = await req.json().catch(() => ({})) as { version?: string };
  const version = body.version ?? pack.latest_version;
  const pv = getPackVersion(pack.id, version);

  if (!pv) {
    return cloudErrorResponse(`Version ${version} not found for this pack`, 404);
  }

  incrementDownload(pack.id);
  auditLog(ctx, 'pack.install', 'pack', pack.id, { version }, req);

  // Safely parse manifest to prevent crashes on corrupted data
  let manifest: unknown;
  try {
    manifest = JSON.parse(pv.manifest_json);
  } catch {
    manifest = { name: pack.name, version };
  }

  return NextResponse.json({
    ok: true,
    pack_id: pack.id,
    slug: pack.slug,
    version,
    installed_at: new Date().toISOString(),
    manifest,
    // CLI install command for users
    install_command: `reachctl packs install ${pack.slug}@${version}`,
  });
}
