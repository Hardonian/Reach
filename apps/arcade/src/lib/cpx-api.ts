import fs from 'fs';
import path from 'path';

export interface CpxRunSummary {
  id: string;
  timestamp: string;
  base_sha: string;
  decision_type: string;
}

function safeRead(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function reportsDir(root: string): string {
  return path.join(root, 'dgl', 'cpx', 'reports');
}

export function listCpxRuns(root: string, page: number, limit: number): { items: CpxRunSummary[]; total: number; page: number; limit: number } {
  const dir = reportsDir(root);
  if (!fs.existsSync(dir)) return { items: [], total: 0, page, limit };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  const total = files.length;
  const start = (Math.max(page, 1) - 1) * Math.max(limit, 1);
  const items = files.slice(start, start + limit).map((f) => {
    const data = safeRead(path.join(dir, f));
    return {
      id: String(data?.run_id ?? f.replace('.json', '')),
      timestamp: String(data?.timestamp ?? ''),
      base_sha: String(data?.base_sha ?? ''),
      decision_type: String((data?.arbitration as Record<string, unknown> | undefined)?.decision_type ?? 'UNKNOWN'),
    };
  });
  return { items, total, page, limit };
}

export function getCpxRun(root: string, id: string): Record<string, unknown> | null {
  return safeRead(path.join(reportsDir(root), `${id}.json`));
}

export function getCpxCandidates(root: string, id: string): Array<Record<string, unknown>> {
  const run = getCpxRun(root, id);
  return (run?.per_patch as Array<Record<string, unknown>> | undefined) ?? [];
}

export function getCpxConflicts(root: string, id: string): Record<string, unknown> {
  const run = getCpxRun(root, id);
  return (run?.conflict_matrix as Record<string, unknown> | undefined) ?? {};
}
