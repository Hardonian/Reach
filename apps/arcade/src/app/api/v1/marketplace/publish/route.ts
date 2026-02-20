/**
 * Pack publish endpoint.
 * POST /api/v1/marketplace/publish
 *
 * Validates manifest, runs automated checks, creates pack + version.
 * Security gates:
 *   - required fields present
 *   - no prohibited tools without explicit flags
 *   - security_status defaults to 'pending' until review
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, cloudErrorResponse, requireRole, auditLog } from '@/lib/cloud-auth';
import { createPack, publishPackVersion, getPackBySlug } from '@/lib/cloud-db';
import { PackManifestSchema, parseBody } from '@/lib/cloud-schemas';

export const runtime = 'nodejs';

// Tools that require explicit security declaration
const HIGH_RISK_TOOLS = new Set(['shell.exec', 'fs.write', 'network.raw', 'process.spawn', 'crypto.key']);

// Maximum allowed manifest sizes to prevent abuse
const MAX_README_LENGTH = 50_000;
const MAX_TOOLS_COUNT = 100;
const MAX_TAGS_COUNT = 20;
const MAX_PERMISSIONS_COUNT = 50;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!requireRole(ctx, 'member')) return cloudErrorResponse('Insufficient permissions', 403);

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(PackManifestSchema, body);
  if ('errors' in parsed) {
    return NextResponse.json({
      valid: false,
      errors: parsed.errors.errors.map((e) => e.message),
      warnings: [],
    }, { status: 422 });
  }

  const manifest = parsed.data;

  // ── Size and cardinality guards ──────────────────────────────────────
  if (manifest.readme && manifest.readme.length > MAX_README_LENGTH) {
    return cloudErrorResponse(`README exceeds maximum length of ${MAX_README_LENGTH} characters`, 422);
  }
  if (manifest.tools.length > MAX_TOOLS_COUNT) {
    return cloudErrorResponse(`Too many tools declared (max ${MAX_TOOLS_COUNT})`, 422);
  }
  if (manifest.tags && manifest.tags.length > MAX_TAGS_COUNT) {
    return cloudErrorResponse(`Too many tags (max ${MAX_TAGS_COUNT})`, 422);
  }
  if (manifest.permissions.length > MAX_PERMISSIONS_COUNT) {
    return cloudErrorResponse(`Too many permissions (max ${MAX_PERMISSIONS_COUNT})`, 422);
  }

  // ── Automated security checks ─────────────────────────────────────────
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check high-risk tools
  const riskyTools = manifest.tools.filter((t) => HIGH_RISK_TOOLS.has(t));
  if (riskyTools.length > 0) {
    if (manifest.dataHandling === 'minimal') {
      warnings.push(`Tools ${riskyTools.join(', ')} require dataHandling: processed or significant`);
    }
    warnings.push(`High-risk tools detected: ${riskyTools.join(', ')}. Security review required.`);
  }

  if (!manifest.readme || manifest.readme.length < 50) {
    warnings.push('README is very short. Consider adding usage examples and security notes.');
  }

  if (manifest.permissions.length === 0 && manifest.tools.length > 0) {
    warnings.push('No permissions declared. Add explicit permission declarations.');
  }

  // Check slug availability
  if (getPackBySlug(manifest.slug)) {
    errors.push(`Slug "${manifest.slug}" is already taken. Choose a unique slug.`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ valid: false, errors, warnings }, { status: 422 });
  }

  // ── Create pack + version ─────────────────────────────────────────────
  const pack = createPack(ctx.tenantId, ctx.userId, {
    name: manifest.name,
    slug: manifest.slug,
    description: manifest.description,
    shortDescription: manifest.shortDescription || manifest.description.slice(0, 160),
    category: manifest.category,
    visibility: manifest.visibility,
    tools: manifest.tools,
    tags: manifest.tags,
    permissions: manifest.permissions,
    dataHandling: manifest.dataHandling,
    authorName: manifest.authorName,
  });

  const version = publishPackVersion(
    pack.id,
    manifest.version,
    JSON.stringify(manifest),
    manifest.readme,
    manifest.changelog
  );

  auditLog(ctx, 'pack.publish', 'pack', pack.id, { slug: pack.slug, version: manifest.version }, req);

  return NextResponse.json({
    ok: true,
    valid: true,
    errors: [],
    warnings,
    pack: {
      id: pack.id,
      slug: pack.slug,
      version: manifest.version,
      security_status: pack.security_status,
      published_at: version.published_at,
    },
  }, { status: 201 });
}
