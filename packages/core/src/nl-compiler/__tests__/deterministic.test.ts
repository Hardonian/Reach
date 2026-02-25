import { describe, it, expect } from 'vitest';
import { stableStringify, sha256Hex } from '../deterministic';
import fs from 'node:fs';
import path from 'node:path';

describe('deterministic.ts - Golden Vectors', () => {
  const vectorsPath = path.join(process.cwd(), 'determinism.vectors.json');
  let vectors: Array<{
    name: string;
    input: unknown;
    expected_ts_fingerprint: string;
    expected_rust_fingerprint: string | null;
    notes: string;
  }>;

  beforeAll(() => {
    try {
      const content = fs.readFileSync(vectorsPath, 'utf8');
      vectors = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read test vectors: ${(error as Error).message}`);
    }
  });

  it('should read and parse test vectors', () => {
    expect(Array.isArray(vectors)).toBeTruthy();
    expect(vectors.length).toBeGreaterThan(0);
  });

  vectors.forEach((vector) => {
    it(`should compute correct fingerprint for vector: ${vector.name}`, () => {
      const canonical = stableStringify(vector.input);
      const fingerprint = sha256Hex(canonical);
      
      expect(fingerprint).toEqual(vector.expected_ts_fingerprint);
    });
  });
});
