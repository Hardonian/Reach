/**
 * Junction Orchestrator
 * 
 * Coordinates junction detection, evaluation, deduplication, and persistence.
 */

import { junctionRepository } from '../../db/decisions';
import { JunctionScanResult, JunctionTemplateResult, JunctionType } from './types';
import { evaluateDiffCritical, type DiffEvidence } from './templates/diffCritical';
import { evaluateDriftAlert, type DriftEvidence } from './templates/driftAlert';
import { evaluateTrustDrop, type TrustEvidence } from './templates/trustDrop';
import { evaluatePolicyViolation, type PolicyViolationEvidence } from './templates/policyViolation';

/**
 * Junction configuration
 */
export interface JunctionConfig {
  diffCritical: {
    enabled: boolean;
    cooldownMinutes: number;
    severityThreshold: number;
  };
  driftAlert: {
    enabled: boolean;
    cooldownMinutes: number;
    severityThreshold: number;
  };
  trustDrop: {
    enabled: boolean;
    cooldownMinutes: number;
    threshold: number;
  };
  policyViolation: {
    enabled: boolean;
    cooldownMinutes: number;
    severityThreshold: number;
  };
}

/**
 * Default junction configuration
 */
export const DEFAULT_JUNCTION_CONFIG: JunctionConfig = {
  diffCritical: {
    enabled: true,
    cooldownMinutes: 60,
    severityThreshold: 0.5,
  },
  driftAlert: {
    enabled: true,
    cooldownMinutes: 60,
    severityThreshold: 0.5,
  },
  trustDrop: {
    enabled: true,
    cooldownMinutes: 60,
    threshold: 0.3,
  },
  policyViolation: {
    enabled: true,
    cooldownMinutes: 60,
    severityThreshold: 0.4,
  },
};

/**
 * Junction Orchestrator
 */
export class JunctionOrchestrator {
  private config: JunctionConfig;
  
  constructor(config: Partial<JunctionConfig> = {}) {
    this.config = { ...DEFAULT_JUNCTION_CONFIG, ...config };
  }
  
  /**
   * Evaluate evidence for all junction types
   */
  evaluateEvidence(data: {
    diff?: DiffEvidence;
    drift?: DriftEvidence;
    trust?: TrustEvidence;
    policy?: PolicyViolationEvidence;
  }): JunctionTemplateResult[] {
    const results: JunctionTemplateResult[] = [];
    
    // Evaluate diff critical
    if (data.diff && this.config.diffCritical.enabled) {
      const result = evaluateDiffCritical(data.diff);
      if (result.shouldTrigger) {
        results.push(result);
      }
    }
    
    // Evaluate drift alert
    if (data.drift && this.config.driftAlert.enabled) {
      const result = evaluateDriftAlert(data.drift);
      if (result.shouldTrigger) {
        results.push(result);
      }
    }
    
    // Evaluate trust drop
    if (data.trust && this.config.trustDrop.enabled) {
      const result = evaluateTrustDrop(data.trust);
      if (result.shouldTrigger) {
        results.push(result);
      }
    }
    
    // Evaluate policy violation
    if (data.policy && this.config.policyViolation.enabled) {
      const result = evaluatePolicyViolation(data.policy);
      if (result.shouldTrigger) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Scan and create junctions from evidence
   */
  async scan(data: {
    diff?: DiffEvidence;
    drift?: DriftEvidence;
    trust?: TrustEvidence;
    policy?: PolicyViolationEvidence;
  }): Promise<JunctionScanResult> {
    const results: JunctionScanResult = {
      triggered: [],
      skipped: [],
      errors: [],
    };
    
    const templateResults = this.evaluateEvidence(data);
    
    for (const template of templateResults) {
      try {
        // Check for existing junction with same fingerprint (deduplication)
        const existing = junctionRepository.getByFingerprint(template.fingerprint);
        
        if (existing) {
          // Skip if within cooldown window
          results.skipped.push(template);
          continue;
        }
        
        // Create new junction
        const junction = junctionRepository.create({
          type: template.type,
          severityScore: template.severityScore,
          fingerprint: template.fingerprint,
          triggerSourceRef: template.triggerSourceRef,
          triggerData: template.triggerData,
          triggerTrace: JSON.stringify(template.triggerTrace),
        });
        
        // Set cooldown
        const cooldownMinutes = this.getCooldownForType(template.type);
        junctionRepository.setCooldown(junction.id, cooldownMinutes);
        
        results.triggered.push(template);
      } catch (error) {
        results.errors.push({
          source: template.triggerSourceRef,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get cooldown minutes for junction type
   */
  private getCooldownForType(type: JunctionType): number {
    switch (type) {
      case 'diff_critical':
        return this.config.diffCritical.cooldownMinutes;
      case 'drift_alert':
        return this.config.driftAlert.cooldownMinutes;
      case 'trust_drop':
        return this.config.trustDrop.cooldownMinutes;
      case 'policy_violation':
        return this.config.policyViolation.cooldownMinutes;
      default:
        return 60;
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<JunctionConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): JunctionConfig {
    return { ...this.config };
  }
}

// Default orchestrator instance
let defaultOrchestrator: JunctionOrchestrator | null = null;

export function getJunctionOrchestrator(): JunctionOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new JunctionOrchestrator();
  }
  return defaultOrchestrator;
}
