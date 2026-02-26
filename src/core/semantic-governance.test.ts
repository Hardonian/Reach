import { describe, expect, it } from 'vitest';
import {
  buildPolicySnapshot,
  calculateIntegrityScore,
  classifyDrift,
  type SemanticPreimageDescriptor,
  validateStrictSemanticState,
} from './semantic-governance';

const descriptor: SemanticPreimageDescriptor = {
  promptTemplateId: 'prompt-support',
  promptTemplateVersion: 'v1',
  modelId: 'gpt',
  modelVersion: '4.1',
  policySnapshotId: 'policy_a',
  contextSnapshotId: 'context_a',
  runtimeId: 'node20',
  evalSnapshotId: 'eval_a',
};

describe('semantic governance', () => {
  it('classifies all drift categories deterministically', () => {
    const result = classifyDrift(descriptor, {
      ...descriptor,
      modelVersion: '4.2',
      promptTemplateVersion: 'v2',
      contextSnapshotId: 'context_b',
      policySnapshotId: 'policy_b',
      evalSnapshotId: 'eval_b',
      runtimeId: 'node22',
    }, true);

    expect(result.driftCategories).toEqual([
      'ModelDrift',
      'PromptDrift',
      'ContextDrift',
      'PolicyDrift',
      'EvalDrift',
      'RuntimeDrift',
    ]);
    expect(result.changeVectors).toMatchInlineSnapshot(`
      [
        "context: context_a -> context_b",
        "eval: eval_a -> eval_b",
        "model: gpt@4.1 -> gpt@4.2",
        "policy: policy_a -> policy_b",
        "prompt: prompt-support@v1 -> prompt-support@v2",
        "runtime: node20 -> node22",
      ]
    `);
  });

  it('falls back to unknown drift on mismatch without descriptor change', () => {
    const result = classifyDrift(descriptor, descriptor, true);
    expect(result.driftCategories).toEqual(['UnknownDrift']);
  });

  it('calculates integrity score with explainable breakdown', () => {
    const score = calculateIntegrityScore({
      parityVerified: true,
      policyBound: true,
      contextCaptured: false,
      evalAttached: true,
      replayVerified: true,
      signaturePresent: false,
    });
    expect(score.score).toBe(80);
    expect(score.breakdown).toHaveLength(6);
  });

  it('enforces strict semantic state keys', () => {
    expect(() => validateStrictSemanticState({ ...descriptor, bad: true })).toThrow('unknown semantic state fields');
  });

  it('creates policy snapshot ids from fingerprint', () => {
    const snapshot = buildPolicySnapshot('policies/main.rego', 'abcdef1234567890ffff', '2026-02-26T00:00:00Z');
    expect(snapshot.id).toBe('policy_abcdef1234567890');
  });
});
