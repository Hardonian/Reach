import { NextRequest, NextResponse } from "next/server";
import { requireAuth, cloudErrorResponse, auditLog } from "@/lib/cloud-auth";
import { getPack, getPackBySlug, getPackVersion, incrementDownload } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const pack = getPackBySlug(id) ?? getPack(id);
  if (!pack) return cloudErrorResponse("Pack not found", 404);

  const body = (await req.json().catch(() => ({}))) as { version?: string };
  const version = body.version ?? pack.latest_version;
  const pv = getPackVersion(pack.id, version);

  incrementDownload(pack.id);
  auditLog(ctx, "pack.install", "pack", pack.id, { version }, req);

  return NextResponse.json({
    ok: true,
    pack_id: pack.id,
    slug: pack.slug,
    version,
    installed_at: new Date().toISOString(),
    manifest: pv ? JSON.parse(pv.manifest_json) : { name: pack.name, version },
    // CLI install command for users
    install_command: `reachctl packs install ${pack.slug}@${version}`,
  });
}
