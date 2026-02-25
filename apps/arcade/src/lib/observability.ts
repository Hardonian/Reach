import fs from "node:fs";
import path from "node:path";

type CounterName =
  | "gate_runs"
  | "artifacts_written"
  | "artifacts_read"
  | "pr_comment_updates"
  | "lease_acquisitions"
  | "lease_releases"
  | "reconciliation_loop_runs"
  | "conflict_classifications_generated";

interface ObservabilityStore {
  counters: Record<CounterName, number>;
  tenantCounters: Record<string, Partial<Record<CounterName, number>>>;
  lastReconciliationRunAt: string | null;
  updatedAt: string;
}

interface CounterOptions {
  tenantId?: string;
  by?: number;
}

const STORE_FILE = "observability.json";
const DEFAULT_COUNTERS: Record<CounterName, number> = {
  gate_runs: 0,
  artifacts_written: 0,
  artifacts_read: 0,
  pr_comment_updates: 0,
  lease_acquisitions: 0,
  lease_releases: 0,
  reconciliation_loop_runs: 0,
  conflict_classifications_generated: 0,
};

declare global {
  // eslint-disable-next-line no-var
  var __reach_observability_store__: ObservabilityStore | undefined;
}

function getDataDir(): string {
  return process.env.REACH_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

function getStorePath(): string {
  return path.join(getDataDir(), STORE_FILE);
}

function mergeCounters(
  base: Record<CounterName, number>,
  next?: Partial<Record<CounterName, number>>,
): Record<CounterName, number> {
  const merged = { ...base };
  if (!next) return merged;
  for (const key of Object.keys(DEFAULT_COUNTERS) as CounterName[]) {
    if (typeof next[key] === "number") {
      merged[key] = next[key] as number;
    }
  }
  return merged;
}

function emptyStore(): ObservabilityStore {
  return {
    counters: { ...DEFAULT_COUNTERS },
    tenantCounters: {},
    lastReconciliationRunAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function loadStoreFromDisk(): ObservabilityStore {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return emptyStore();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<ObservabilityStore>;
    const store = emptyStore();
    store.counters = mergeCounters(store.counters, raw.counters);
    store.lastReconciliationRunAt =
      typeof raw.lastReconciliationRunAt === "string" ? raw.lastReconciliationRunAt : null;
    store.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : store.updatedAt;

    if (raw.tenantCounters && typeof raw.tenantCounters === "object") {
      for (const [tenantId, counters] of Object.entries(raw.tenantCounters)) {
        store.tenantCounters[tenantId] = mergeCounters(DEFAULT_COUNTERS, counters);
      }
    }

    return store;
  } catch {
    return emptyStore();
  }
}

function persistStore(store: ObservabilityStore): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2));
  } catch {
    // Non-blocking persistence.
  }
}

function getStore(): ObservabilityStore {
  if (!globalThis.__reach_observability_store__) {
    globalThis.__reach_observability_store__ = loadStoreFromDisk();
  }
  return globalThis.__reach_observability_store__;
}

export function incrementCounter(name: CounterName, options?: CounterOptions): number {
  const store = getStore();
  const by = Math.max(1, options?.by ?? 1);
  store.counters[name] += by;

  if (options?.tenantId) {
    const existing = mergeCounters(DEFAULT_COUNTERS, store.tenantCounters[options.tenantId]);
    existing[name] = (existing[name] ?? 0) + by;
    store.tenantCounters[options.tenantId] = existing;
  }

  store.updatedAt = new Date().toISOString();
  persistStore(store);
  return store.counters[name];
}

export function markReconciliationRun(tenantId?: string): void {
  const store = getStore();
  store.lastReconciliationRunAt = new Date().toISOString();
  store.updatedAt = store.lastReconciliationRunAt;
  incrementCounter("reconciliation_loop_runs", { tenantId });
  persistStore(store);
}

export function getObservabilitySnapshot(): ObservabilityStore {
  const store = getStore();
  return {
    counters: { ...store.counters },
    tenantCounters: { ...store.tenantCounters },
    lastReconciliationRunAt: store.lastReconciliationRunAt,
    updatedAt: store.updatedAt,
  };
}
