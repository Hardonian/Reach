import { NextRequest, NextResponse } from 'next/server';
import { browsePacks } from '@/lib/cloud-db';
import { BrowsePacksSchema, parseBody } from '@/lib/cloud-schemas';
import { cloudErrorResponse } from '@/lib/cloud-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const qp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = parseBody(BrowsePacksSchema, qp);
    if ('errors' in parsed) return cloudErrorResponse(parsed.errors.issues[0]?.message ?? 'Invalid query', 400);

    const { search, category, sort, verifiedOnly, page, limit } = parsed.data;
    const result = browsePacks({ search, category, sort, verifiedOnly, page, limit, visibility: 'public' });

    return NextResponse.json({
      packs: result.packs.map(formatPack),
      total: result.total,
      page,
      limit,
      has_more: result.total > page * limit,
    });
  } catch (err) {
    logger.error('Failed to browse marketplace', err);
    return cloudErrorResponse('Failed to browse marketplace', 500);
  }
}

/** Safely parse JSON or return fallback. */
function safeJsonParse(json: string | null | undefined, fallback: unknown = []): unknown {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function formatPack(p: ReturnType<typeof browsePacks>['packs'][number]) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    short_description: p.short_description,
    category: p.category,
    visibility: p.visibility,
    latest_version: p.latest_version,
    author_name: p.author_name,
    verified: p.verified === 1,
    security_status: p.security_status,
    reputation_score: p.reputation_score,
    downloads: p.downloads,
    rating: p.rating_count > 0 ? p.rating_sum / p.rating_count : 0,
    rating_count: p.rating_count,
    tools: safeJsonParse(p.tools_json, []),
    tags: safeJsonParse(p.tags_json, []),
    permissions: safeJsonParse(p.permissions_json, []),
    data_handling: p.data_handling,
    flagged: p.flagged === 1,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}
