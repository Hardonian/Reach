import { getDB } from './connection';
import { newId } from './helpers';
import { type Pack, type PackVersion } from './types';

export function createPack(tenantId: string | null, authorId: string, input: {
  name: string; slug: string; description: string; shortDescription: string;
  category: string; visibility: string; tools: string[]; tags: string[];
  permissions: string[]; dataHandling: string; authorName: string;
}): Pack {
  const db = getDB();
  const id = newId('pck');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO packs (id, tenant_id, name, slug, description, short_description, category,
    visibility, latest_version, author_id, author_name, tools_json, tags_json, permissions_json,
    data_handling, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,'0.0.0',?,?,?,?,?,?,?,?)`)
    .run(id, tenantId, input.name, input.slug, input.description, input.shortDescription,
      input.category, input.visibility, authorId, input.authorName,
      JSON.stringify(input.tools), JSON.stringify(input.tags),
      JSON.stringify(input.permissions), input.dataHandling, now, now);
  return getPack(id)!;
}

export function getPack(id: string): Pack | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM packs WHERE id=? AND deleted_at IS NULL').get(id) as Pack | undefined;
}

export function getPackBySlug(slug: string): Pack | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM packs WHERE slug=? AND deleted_at IS NULL').get(slug) as Pack | undefined;
}

export function browsePacks(opts: {
  search?: string; category?: string; verifiedOnly?: boolean; trending?: boolean;
  sort?: string; page?: number; limit?: number; visibility?: string;
}): { packs: Pack[]; total: number } {
  const db = getDB();
  const { search, category, verifiedOnly, sort, page = 1, limit = 12, visibility = 'public' } = opts;
  const conditions: string[] = ['p.deleted_at IS NULL', 'p.flagged=0'];
  const params: (string | number)[] = [];

  conditions.push('p.visibility=?');
  params.push(visibility);

  if (search) {
    conditions.push(`(p.name LIKE ? OR p.description LIKE ? OR p.tags_json LIKE ?)`);
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (category && category !== 'all') {
    conditions.push('p.category=?');
    params.push(category);
  }
  if (verifiedOnly) {
    conditions.push('p.verified=1');
  }

  const where = conditions.join(' AND ');
  const orderMap: Record<string, string> = {
    newest: 'p.updated_at DESC',
    trending: 'p.downloads DESC',
    rating: '(CASE WHEN p.rating_count>0 THEN p.rating_sum/p.rating_count ELSE 0 END) DESC',
    reputation: 'p.reputation_score DESC',
    relevance: 'p.reputation_score DESC',
  };
  const order = orderMap[sort ?? 'relevance'] ?? 'p.reputation_score DESC';
  const offset = (page - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM packs p WHERE ${where}`).get(...params) as { cnt: number }).cnt;
  const packs = db.prepare(`SELECT p.* FROM packs p WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Pack[];
  return { packs, total };
}

export function incrementDownload(id: string): void {
  const db = getDB();
  db.prepare('UPDATE packs SET downloads=downloads+1 WHERE id=?').run(id);
}

export function publishPackVersion(packId: string, version: string, manifestJson: string, readme: string, changelog: string): PackVersion {
  const db = getDB();
  const id = newId('pkv');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pack_versions (id, pack_id, version, manifest_json, readme, changelog, published_at)
    VALUES (?,?,?,?,?,?,?)`)
    .run(id, packId, version, manifestJson, readme, changelog, now);
  db.prepare('UPDATE packs SET latest_version=?, updated_at=? WHERE id=?').run(version, now, packId);
  return getPackVersion(packId, version)!;
}

export function getPackVersion(packId: string, version: string): PackVersion | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM pack_versions WHERE pack_id=? AND version=?').get(packId, version) as PackVersion | undefined;
}

export function listPackVersions(packId: string): PackVersion[] {
  const db = getDB();
  return db.prepare('SELECT * FROM pack_versions WHERE pack_id=? ORDER BY published_at DESC').all(packId) as PackVersion[];
}
