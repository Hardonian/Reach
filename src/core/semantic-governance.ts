export type SemanticStateId = string;

export type DriftCategory =
  | 'ModelDrift'
  | 'PromptDrift'
  | 'ContextDrift'
  | 'PolicyDrift'
  | 'EvalDrift'
  | 'RuntimeDrift'
  | 'UnknownDrift';

export interface SemanticPreimageDescriptor {
  promptTemplateId: string;
  promptTemplateVersion: string;
  modelId: string;
  modelVersion: string;
  policySnapshotId: string;
  contextSnapshotId: string;
  runtimeId: string;
  evalSnapshotId?: string;
}

export interface SemanticState {
  id: SemanticStateId;
  createdAt: string;
  actor: string;
  source: 'cli' | 'api' | 'console' | 'system';
  labels: string[];
  descriptor: SemanticPreimageDescriptor;
}

export interface PolicySnapshot {
  id: string;
  sourceRef: string;
  effectiveFrom: string;
  effectiveTo?: string;
  fingerprint: string;
}

export interface EvalSnapshot {
  id: string;
  datasetRef: string;
  metricWeights: Record<string, number>;
  thresholds: Record<string, number>;
  resultsSummary: string;
}

export interface IntegritySignals {
  parityVerified: boolean;
  policyBound: boolean;
  contextCaptured: boolean;
  evalAttached: boolean;
  replayVerified: boolean;
  signaturePresent: boolean;
}

export interface IntegrityScore {
  score: number;
  breakdown: Array<{ signal: keyof IntegritySignals; weight: number; passed: boolean }>;
}

export interface SemanticTransition {
  fromId?: SemanticStateId;
  toId: SemanticStateId;
  reason: string;
  changeVectors: string[];
  integrityScore: IntegrityScore;
  driftClassification: DriftCategory[];
  evidenceLinks: string[];
}

export interface DriftClassificationResult {
  driftCategories: DriftCategory[];
  changeVectors: string[];
}

const INTEGRITY_WEIGHTS: Record<keyof IntegritySignals, number> = {
  parityVerified: 30,
  policyBound: 20,
  contextCaptured: 15,
  evalAttached: 10,
  replayVerified: 20,
  signaturePresent: 5,
};

export function classifyDrift(
  before: SemanticPreimageDescriptor,
  after: SemanticPreimageDescriptor,
  mismatchObserved: boolean,
): DriftClassificationResult {
  const categories: DriftCategory[] = [];
  const vectors: string[] = [];

  const detect = (condition: boolean, category: DriftCategory, vector: string) => {
    if (condition) {
      categories.push(category);
      vectors.push(vector);
    }
  };

  detect(before.modelId !== after.modelId || before.modelVersion !== after.modelVersion, 'ModelDrift', `model: ${before.modelId}@${before.modelVersion} -> ${after.modelId}@${after.modelVersion}`);
  detect(before.promptTemplateId !== after.promptTemplateId || before.promptTemplateVersion !== after.promptTemplateVersion, 'PromptDrift', `prompt: ${before.promptTemplateId}@${before.promptTemplateVersion} -> ${after.promptTemplateId}@${after.promptTemplateVersion}`);
  detect(before.contextSnapshotId !== after.contextSnapshotId, 'ContextDrift', `context: ${before.contextSnapshotId} -> ${after.contextSnapshotId}`);
  detect(before.policySnapshotId !== after.policySnapshotId, 'PolicyDrift', `policy: ${before.policySnapshotId} -> ${after.policySnapshotId}`);
  detect((before.evalSnapshotId ?? '') !== (after.evalSnapshotId ?? ''), 'EvalDrift', `eval: ${before.evalSnapshotId ?? 'none'} -> ${after.evalSnapshotId ?? 'none'}`);
  detect(before.runtimeId !== after.runtimeId, 'RuntimeDrift', `runtime: ${before.runtimeId} -> ${after.runtimeId}`);

  if (categories.length === 0 && mismatchObserved) {
    categories.push('UnknownDrift');
    vectors.push('fingerprint mismatch observed with unchanged descriptor fields');
  }

  return {
    driftCategories: Array.from(new Set(categories)),
    changeVectors: vectors.sort(),
  };
}

export function calculateIntegrityScore(signals: IntegritySignals): IntegrityScore {
  const breakdown = (Object.keys(INTEGRITY_WEIGHTS) as Array<keyof IntegritySignals>).map((signal) => ({
    signal,
    weight: INTEGRITY_WEIGHTS[signal],
    passed: signals[signal],
  }));
  const score = breakdown.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0);
  return { score, breakdown };
}

export function validateStrictSemanticState(input: unknown): SemanticState {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('semantic state must be an object');
  }
  const value = input as Record<string, unknown>;
  const allowedKeys = ['id', 'createdAt', 'actor', 'source', 'labels', 'descriptor'];
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`unknown semantic state fields: ${unknownKeys.join(', ')}`);
  }
  const requiredKeys = ['id', 'createdAt', 'actor', 'source', 'labels', 'descriptor'];
  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`missing semantic state field: ${key}`);
    }
  }
  return value as unknown as SemanticState;
}

export function buildPolicySnapshot(sourceRef: string, fingerprint: string, effectiveFrom: string, effectiveTo?: string): PolicySnapshot {
  return {
    id: `policy_${fingerprint.slice(0, 16)}`,
    sourceRef,
    effectiveFrom,
    effectiveTo,
    fingerprint,
  };
}
