export interface RunRecord {
  run_id: string;
  timestamp: string;
  repo: string;
  base_sha: string;
  head_sha: string;
  provider?: { provider?: string };
  violations?: Array<Record<string, unknown>>;
  turbulence_hotspots?: Array<Record<string, unknown>>;
}

function pageSlice<T>(rows: T[], page: number, limit: number) {
  const p = Math.max(1, page);
  const l = Math.max(1, Math.min(limit, 200));
  const start = (p - 1) * l;
  return { rows: rows.slice(start, start + l), total: rows.length, page: p, limit: l };
}

export function listRuns(records: RunRecord[], query: { page?: number; limit?: number; branch?: string; provider?: string }) {
  const branch = (query.branch ?? '').toLowerCase();
  const provider = (query.provider ?? '').toLowerCase();
  const filtered = records.filter((r) => {
    const branchHit = branch ? `${r.base_sha} ${r.head_sha}`.toLowerCase().includes(branch) : true;
    const providerHit = provider ? String(r.provider?.provider ?? '').toLowerCase().includes(provider) : true;
    return branchHit && providerHit;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return pageSlice(filtered, query.page ?? 1, query.limit ?? 20);
}

export function listViolations(record: RunRecord, query: { page?: number; limit?: number; severity?: string; type?: string; subsystem?: string; pathQuery?: string }) {
  const severity = (query.severity ?? '').toLowerCase();
  const type = (query.type ?? '').toLowerCase();
  const subsystem = (query.subsystem ?? '').toLowerCase();
  const pathQuery = (query.pathQuery ?? '').toLowerCase();
  const rows = (record.violations ?? []).filter((v) => {
    const sevHit = severity ? String(v.severity ?? '').toLowerCase() === severity : true;
    const typeHit = type ? String(v.type ?? '').toLowerCase() === type : true;
    const subHit = subsystem ? JSON.stringify(v).toLowerCase().includes(subsystem) : true;
    const pathHit = pathQuery ? JSON.stringify(v.paths ?? []).toLowerCase().includes(pathQuery) : true;
    return sevHit && typeHit && subHit && pathHit;
  }).sort((a, b) => `${b.severity ?? ''}`.localeCompare(`${a.severity ?? ''}`) || `${a.type ?? ''}`.localeCompare(`${b.type ?? ''}`) || JSON.stringify(a.paths ?? []).localeCompare(JSON.stringify(b.paths ?? [])));
  return pageSlice(rows, query.page ?? 1, query.limit ?? 20);
}

export function listTurbulence(record: RunRecord, query: { page?: number; limit?: number; severity?: string; pathPrefix?: string }) {
  const prefix = (query.pathPrefix ?? '').toLowerCase();
  const rows = (record.turbulence_hotspots ?? []).filter((t) => prefix ? String(t.path ?? '').toLowerCase().startsWith(prefix) : true);
  return pageSlice(rows, query.page ?? 1, query.limit ?? 20);
}
