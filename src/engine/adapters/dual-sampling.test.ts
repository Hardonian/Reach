import { describe, it, expect } from 'vitest';
import { AdaptiveDualRunSampler } from './dual-sampling';
import { FuzzGenerator } from './base';

describe('AdaptiveDualRunSampler', () => {
  it('shouldSample returns false for requests with floating point values', () => {
    const sampler = new AdaptiveDualRunSampler();
    
    // Generate a request with floating point values (invalid)
    const request = FuzzGenerator.generateFloatRequest();
    
    // Verify that the sampler rejects it
    // shouldSample takes (request, engineVersion)
    const result = sampler.shouldSample(request, '1.0.0');
    
    expect(result).toBe(false);
    
    // Verify validation details directly
    const validation = sampler.validateInput(request);
    expect(validation.valid).toBe(false);
    expect(validation.errors?.some(e => e.includes('floating_point_values_detected'))).toBe(true);
  });
});