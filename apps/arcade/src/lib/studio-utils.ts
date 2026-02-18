export interface PackManifest {
  name: string;
  specVersion: string;
  policyContract?: string;
  tests: string[];
  signature?: string;
}

export interface EventStep {
  index: number;
  type: string;
  payloadHash: string;
}

export interface FederationNode {
  nodeId: string;
  trustScore: number;
  p50Ms: number;
  p95Ms: number;
  successCount: number;
  failureCount: number;
  quarantined: boolean;
}

export function validatePackManifest(manifest: PackManifest) {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!manifest.name.trim()) {
    errors.push('Pack name is required.');
  }

  if (!/^\d+\.\d+$/.test(manifest.specVersion)) {
    errors.push('specVersion must be major.minor (example: 1.0).');
  }

  if (!manifest.policyContract || !manifest.policyContract.trim()) {
    errors.push('Policy declaration is required.');
  }

  if (manifest.tests.length === 0) {
    errors.push('At least one conformance test is required.');
  }

  if (!manifest.signature) {
    warnings.push('Unsigned pack: run sign before publish.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function compareEventStreams(left: EventStep[], right: EventStep[]) {
  const maxLength = Math.max(left.length, right.length);
  const diff: Array<{ index: number; left?: EventStep; right?: EventStep; mismatch: string }> = [];

  for (let i = 0; i < maxLength; i += 1) {
    const lhs = left[i];
    const rhs = right[i];

    if (!lhs || !rhs) {
      diff.push({ index: i, left: lhs, right: rhs, mismatch: 'missing-step' });
      continue;
    }

    if (lhs.type !== rhs.type || lhs.payloadHash !== rhs.payloadHash) {
      diff.push({ index: i, left: lhs, right: rhs, mismatch: 'event-mismatch' });
    }
  }

  return diff;
}

export function deterministicArenaScore(seed: string, weights: number[]) {
  const normalized = seed.trim().toLowerCase();
  let hash = 2166136261;

  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return weights.reduce((total, weight, idx) => {
    const lane = (hash >>> (idx % 24)) & 0xff;
    return total + lane * weight;
  }, 0);
}

export function federationReadModel(nodes: FederationNode[]) {
  const total = nodes.length;
  const quarantined = nodes.filter((n) => n.quarantined).length;
  const avgTrust = total === 0 ? 0 : Math.round(nodes.reduce((sum, n) => sum + n.trustScore, 0) / total);
  return { total, quarantined, avgTrust };
}
