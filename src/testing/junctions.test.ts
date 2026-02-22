/**
 * Junction Test Harness
 * Tests for junction detection, deduplication, and lifecycle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDiffCriticalTrigger,
  evaluateDiffCritical,
  DIFF_CRITICAL_FIXTURE,
} from '../junctions/templates/diffCritical';
import {
  createDriftAlertTrigger,
  evaluateDriftAlert,
  DRIFT_ALERT_FIXTURE,
} from '../junctions/templates/driftAlert';
import {
  createTrustDropTrigger,
  evaluateTrustDrop,
  TRUST_DROP_FIXTURE,
} from '../junctions/templates/trustDrop';
import {
  createPolicyViolationTrigger,
  evaluatePolicyViolation,
  POLICY_VIOLATION_FIXTURE,
} from '../junctions/templates/policyViolation';
import { generateJunctionFingerprint, generateDeduplicationKey, getSeverityLevel } from '../junctions/types';

describe('Junction Templates', () => {
  describe('Diff Critical', () => {
    it('should evaluate diff critical correctly', () => {
      const result = evaluateDiffCritical(DIFF_CRITICAL_FIXTURE);
      
      expect(result.shouldTrigger).toBe(true);
      expect(result.severityScore).toBeGreaterThan(0.7);
      expect(result.triggerTrace).toHaveProperty('algorithm', 'diff_critical_evaluation');
    });

    it('should create diff critical trigger with proper structure', () => {
      const trigger = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
      
      expect(trigger.type).toBe('diff_critical');
      expect(trigger.sourceType).toBe('diff');
      expect(trigger.severityScore).toBeGreaterThan(0);
      expect(trigger.triggerData).toBeDefined();
      expect(trigger.triggerTrace).toBeDefined();
    });

    it('should generate deterministic fingerprint', () => {
      const trigger1 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
      const trigger2 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
      
      const fp1 = generateJunctionFingerprint(trigger1);
      const fp2 = generateJunctionFingerprint(trigger2);
      
      expect(fp1).toBe(fp2);
    });
  });

  describe('Drift Alert', () => {
    it('should evaluate drift alert correctly', () => {
      const result = evaluateDriftAlert(DRIFT_ALERT_FIXTURE);
      
      expect(result.shouldTrigger).toBe(true);
      expect(result.severityScore).toBeGreaterThan(0.4);
      expect(result.triggerTrace).toHaveProperty('algorithm', 'drift_alert_evaluation');
    });

    it('should increase severity for increasing trend', () => {
      const data = { ...DRIFT_ALERT_FIXTURE, trend: 'increasing' as const };
      const increasingResult = evaluateDriftAlert(data);
      const stableResult = evaluateDriftAlert({ ...DRIFT_ALERT_FIXTURE, trend: 'stable' as const });
      
      expect(increasingResult.severityScore).toBeGreaterThanOrEqual(stableResult.severityScore);
    });
  });

  describe('Trust Drop', () => {
    it('should evaluate trust drop correctly', () => {
      const result = evaluateTrustDrop(TRUST_DROP_FIXTURE);
      
      expect(result.shouldTrigger).toBe(true);
      expect(result.severityScore).toBeGreaterThan(0);
      expect(result.triggerTrace).toHaveProperty('algorithm', 'trust_drop_evaluation');
    });

    it('should trigger for critical trust level', () => {
      const criticalData = {
        ...TRUST_DROP_FIXTURE,
        currentTrustScore: 0.3,
        previousTrustScore: 0.35,
      };
      
      const result = evaluateTrustDrop(criticalData);
      
      expect(result.shouldTrigger).toBe(true);
    });
  });

  describe('Policy Violation', () => {
    it('should evaluate policy violation correctly', () => {
      const result = evaluatePolicyViolation(POLICY_VIOLATION_FIXTURE);
      
      expect(result.shouldTrigger).toBe(true);
      expect(result.severityScore).toBeGreaterThan(0.3);
      expect(result.triggerTrace).toHaveProperty('algorithm', 'policy_violation_evaluation');
    });

    it('should reduce severity when remediation is available', () => {
      const withRemediation = evaluatePolicyViolation(POLICY_VIOLATION_FIXTURE);
      const withoutRemediation = evaluatePolicyViolation({
        ...POLICY_VIOLATION_FIXTURE,
        remediationAvailable: false,
      });
      
      expect(withRemediation.severityScore).toBeLessThanOrEqual(withoutRemediation.severityScore);
    });
  });
});

describe('Junction Utilities', () => {
  describe('Severity Level', () => {
    it('should return critical for scores >= 0.9', () => {
      expect(getSeverityLevel(0.9)).toBe('critical');
      expect(getSeverityLevel(1.0)).toBe('critical');
    });

    it('should return high for scores >= 0.7 and < 0.9', () => {
      expect(getSeverityLevel(0.7)).toBe('high');
      expect(getSeverityLevel(0.89)).toBe('high');
    });

    it('should return medium for scores >= 0.4 and < 0.7', () => {
      expect(getSeverityLevel(0.4)).toBe('medium');
      expect(getSeverityLevel(0.69)).toBe('medium');
    });

    it('should return low for scores < 0.4', () => {
      expect(getSeverityLevel(0.0)).toBe('low');
      expect(getSeverityLevel(0.39)).toBe('low');
    });
  });

  describe('Deduplication Key', () => {
    it('should generate same key for same trigger', () => {
      const trigger = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
      const key1 = generateDeduplicationKey(trigger);
      const key2 = generateDeduplicationKey(trigger);
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different source refs', () => {
      const trigger1 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
      const trigger2 = createDiffCriticalTrigger({ ...DIFF_CRITICAL_FIXTURE, runId: 'different_run' });
      
      const key1 = generateDeduplicationKey(trigger1);
      const key2 = generateDeduplicationKey(trigger2);
      
      expect(key1).not.toBe(key2);
    });
  });
});

describe('Property-based Tests', () => {
  it('repeated scan with same data should not create duplicate fingerprints', () => {
    const trigger1 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
    const trigger2 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
    
    const fp1 = generateJunctionFingerprint(trigger1);
    const fp2 = generateJunctionFingerprint(trigger2);
    
    expect(fp1).toBe(fp2);
  });

  it('small changes should produce new fingerprint', () => {
    const trigger1 = createDiffCriticalTrigger(DIFF_CRITICAL_FIXTURE);
    const trigger2 = createDiffCriticalTrigger({
      ...DIFF_CRITICAL_FIXTURE,
      runId: 'run_test_001_modified',
    });
    
    const fp1 = generateJunctionFingerprint(trigger1);
    const fp2 = generateJunctionFingerprint(trigger2);
    
    expect(fp1).not.toBe(fp2);
  });

  it('severity scoring should be stable across runs', () => {
    const result1 = evaluateDiffCritical(DIFF_CRITICAL_FIXTURE);
    const result2 = evaluateDiffCritical(DIFF_CRITICAL_FIXTURE);
    
    expect(result1.severityScore).toBe(result2.severityScore);
    expect(result1.shouldTrigger).toBe(result2.shouldTrigger);
  });
});
