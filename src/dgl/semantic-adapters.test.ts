import { describe, expect, it } from 'vitest';
import { diffAstExports } from './ast-diff.js';
import { diffApiContract } from './api-contract-diff.js';

describe('semantic adapters', () => {
  it('detects AST export signature drift', () => {
    const base = `export function run(a: string): number { return 1; }`;
    const head = `export function run(a: string, b: string): number { return 1; }`;
    const violations = diffAstExports('src/foo.ts', base, head);
    expect(violations.some((v) => v.type === 'semantic')).toBe(true);
    expect(violations[0]?.line).toBeGreaterThan(0);
  });

  it('detects API schema property removals with lines', () => {
    const base = JSON.stringify({ properties: { a: { type: 'string' }, b: { type: 'number' } } }, null, 2);
    const head = JSON.stringify({ properties: { a: { type: 'string' } } }, null, 2);
    const violations = diffApiContract('protocol/schemas/events.schema.json', base, head);
    expect(violations.some((v) => v.severity === 'error')).toBe(true);
    expect(violations[0]?.line).toBeGreaterThan(0);
  });

  it('detects nested required and enum drift', () => {
    const base = JSON.stringify({
      properties: {
        status: { enum: ['new', 'done'] },
      },
      required: ['status', 'id'],
    }, null, 2);
    const head = JSON.stringify({
      properties: {
        status: { enum: ['new', 'in_progress'] },
      },
      required: ['status'],
    }, null, 2);

    const violations = diffApiContract('protocol/schemas/example.schema.json', base, head);
    expect(violations.some((v) => v.evidence.includes('Required field removed'))).toBe(true);
    expect(violations.some((v) => v.evidence.includes('Enum value removed'))).toBe(true);
  });

  it('detects OpenAPI path removal from yaml', () => {
    const base = `openapi: 3.0.0
paths:
  /runs:
    get:
      description: list runs
  /health:
    get:
      description: health
`;
    const head = `openapi: 3.0.0
paths:
  /runs:
    get:
      description: list runs
`;
    const violations = diffApiContract('openapi/reach.openapi.yaml', base, head);
    expect(violations.some((v) => v.evidence.includes('OpenAPI path removed'))).toBe(true);
  });

});
