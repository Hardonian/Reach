/**
 * Fuzz Testing Suite for Engine Adapters
 * 
 * Uses FuzzGenerator to validate robustness against:
 * - Random valid inputs
 * - Floating point injections (determinism violation)
 * - Large payload stress tests
 */

import { describe, it, expect } from 'vitest';
import { RequiemEngineAdapter } from './requiem';
import { FuzzGenerator } from './base';

describe('RequiemEngineAdapter Fuzzing', () => {
  it('accepts valid fuzz requests', () => {
    const adapter = new RequiemEngineAdapter();
    const request = FuzzGenerator.generateValidRequest();
    const validation = adapter.validateInput(request);
    expect(validation.valid).toBe(true);
  });

  it('rejects float fuzz requests (determinism guard)', () => {
    const adapter = new RequiemEngineAdapter();
    const request = FuzzGenerator.generateFloatRequest();
    const validation = adapter.validateInput(request);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors?.some(e => e.includes('floating_point_values_detected'))).toBe(true);
  });

  it('handles massive fuzz requests (stress test)', () => {
    // Configure with high limit for stress test
    const adapter = new RequiemEngineAdapter({
      maxMatrixCells: 1_000_000
    });
    
    // Generate request with 500 actions * 2 states = 1000 cells (well within 1M limit)
    const request = FuzzGenerator.generateMassiveRequest('stress-test', 500); 
    const validation = adapter.validateInput(request);
    expect(validation.valid).toBe(true);
  });
  
  it('rejects massive requests exceeding configured limits', () => {
    const adapter = new RequiemEngineAdapter({ maxMatrixCells: 100 });
    const request = FuzzGenerator.generateMassiveRequest('stress-fail', 100); // 200 cells > 100 limit
    const validation = adapter.validateInput(request);
    expect(validation.valid).toBe(false);
    expect(validation.errors?.some(e => e.includes('matrix_too_large'))).toBe(true);
  });
});