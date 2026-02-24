import { describe, it, expect } from 'vitest';
import path from 'path';
import { compareOpenApi } from './openapi-compat.js';

describe('openapi compat', () => {
  it('detects breaking required param and removed response field', () => {
    const root = process.cwd();
    const result = compareOpenApi(path.join(root, 'dgl/fixtures/openapi/base.json'), path.join(root, 'dgl/fixtures/openapi/head-breaking.json'), root);
    expect(result.summary.breaking).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.evidence.includes('required parameter'))).toBe(true);
  });

  it('flags additive change as warning', () => {
    const root = process.cwd();
    const result = compareOpenApi(path.join(root, 'dgl/fixtures/openapi/base.json'), path.join(root, 'dgl/fixtures/openapi/head-warn.json'), root);
    expect(result.summary.warnings).toBeGreaterThan(0);
  });
});
