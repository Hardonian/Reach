/**
 * Control-Plane Event Export
 * 
 * JSONL event stream for ReadyLayer integration:
 * - No secrets in output
 * - Stable schema (additive-only)
 * - Engine version, contract version, protocol version
 * - Fingerprint and confidence metrics
 * - Redacted metadata
 * 
 * @module engine/events/event-export
 */

import { ExecRequest, ExecResult } from '../contract';
import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Event schema version (additive-only)
 */
export const EVENT_SCHEMA_VERSION = '1.0.0';

/**
 * Event types for the control plane
 */
export enum ControlPlaneEventType {
  EXECUTION_START = 'execution_start',
  EXECUTION_COMPLETE = 'execution_complete',
  EXECUTION_ERROR = 'execution_error',
  ENGINE_SWITCH = 'engine_switch',
  DUAL_RUN_MISMATCH = 'dual_run_mismatch',
  POLICY_VIOLATION = 'policy_violation',
  ROLLBACK = 'rollback',
}

/**
 * Base event structure (stable schema)
 */
export interface ControlPlaneEvent {
  /** Event schema version */
  schema_version: string;
  /** Event type */
  event_type: ControlPlaneEventType;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Unique event ID */
  event_id: string;
  /** Request ID that triggered the event */
  request_id: string;
  /** Tenant ID (derived, not PII) */
  tenant_id: string;
  /** Engine version that processed the request */
  engine_version: string;
  /** Contract version */
  contract_version: string;
  /** Protocol version */
  protocol_version: string;
}

/**
 * Execution start event
 */
export interface ExecutionStartEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.EXECUTION_START;
  /** Algorithm used */
  algorithm: string;
  /** Engine type (requiem, rust, ts) */
  engine_type: string;
  /** Whether dual-run sampling is active */
  dual_run_enabled: boolean;
  /** Sampling rate applied (0-1) */
  sampling_rate: number;
}

/**
 * Execution complete event
 */
export interface ExecutionCompleteEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.EXECUTION_COMPLETE;
  /** Algorithm used */
  algorithm: string;
  /** Engine type that produced the result */
  engine_type: string;
  /** Result fingerprint (hash) */
  fingerprint: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Execution duration in milliseconds */
  duration_ms: number;
  /** Result status */
  status: 'success' | 'error' | 'timeout';
  /** Recommended action (sanitized) */
  recommended_action_hash: string;
  /** Whether dual-run comparison was performed */
  dual_run_performed: boolean;
  /** Dual-run match result (if performed) */
  dual_run_match?: boolean;
  /** Number of actions in request */
  action_count: number;
  /** Number of states in request */
  state_count: number;
}

/**
 * Execution error event
 */
export interface ExecutionErrorEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.EXECUTION_ERROR;
  /** Error code (structured, no secrets) */
  error_code: string;
  /** Error severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Whether error is retryable */
  retryable: boolean;
  /** Engine type that failed */
  engine_type: string;
  /** Fallback engine used (if any) */
  fallback_engine?: string;
}

/**
 * Engine switch event
 */
export interface EngineSwitchEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.ENGINE_SWITCH;
  /** Previous engine */
  from_engine: string;
  /** New engine */
  to_engine: string;
  /** Reason for switch */
  reason: string;
  /** Whether switch was forced via env var */
  forced: boolean;
}

/**
 * Dual-run mismatch event
 */
export interface DualRunMismatchEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.DUAL_RUN_MISMATCH;
  /** Primary engine */
  primary_engine: string;
  /** Secondary engine */
  secondary_engine: string;
  /** Number of differences found */
  difference_count: number;
  /** Types of differences (generic, no data) */
  difference_types: string[];
  /** Whether fingerprints matched */
  fingerprint_match: boolean;
}

/**
 * Policy violation event
 */
export interface PolicyViolationEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.POLICY_VIOLATION;
  /** Policy rule violated (ID only, no data) */
  policy_rule_id: string;
  /** Severity of violation */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Action taken */
  action: 'allow' | 'deny' | 'quarantine';
}

/**
 * Rollback event
 */
export interface RollbackEvent extends ControlPlaneEvent {
  event_type: ControlPlaneEventType.ROLLBACK;
  /** Engine rolled back from */
  from_engine: string;
  /** Engine rolled back to */
  to_engine: string;
  /** Reason for rollback */
  reason: string;
  /** Whether rollback was successful */
  success: boolean;
}

/**
 * Union of all event types
 */
export type AnyControlPlaneEvent =
  | ExecutionStartEvent
  | ExecutionCompleteEvent
  | ExecutionErrorEvent
  | EngineSwitchEvent
  | DualRunMismatchEvent
  | PolicyViolationEvent
  | RollbackEvent;

/**
 * Event export configuration
 */
export interface EventExportConfig {
  /** Path to store event files */
  outputPath: string;
  /** Maximum file size before rotation (bytes) */
  maxFileSize: number;
  /** Maximum number of files to keep */
  maxFiles: number;
  /** Whether to redact all potentially sensitive metadata */
  strictRedaction: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EventExportConfig = {
  outputPath: '.reach/events',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  strictRedaction: true,
};

/**
 * Event exporter for control plane integration
 */
export class ControlPlaneEventExporter {
  private config: EventExportConfig;
  private currentFile: string | null = null;
  private currentFileSize = 0;
  private fileCounter = 0;
  private readonly protocolVersion = '1.0.0';
  private readonly contractVersion = '1.0.0';
  
  constructor(config: Partial<EventExportConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureOutputDirectory();
  }
  
  // ============================================================================
  // Event Factory Methods
  // ============================================================================
  
  createExecutionStartEvent(
    request: ExecRequest,
    engineVersion: string,
    engineType: string,
    dualRunEnabled: boolean,
    samplingRate: number
  ): ExecutionStartEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.EXECUTION_START,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: request.requestId,
      tenant_id: this.deriveTenantId(request),
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      algorithm: request.params.algorithm,
      engine_type: engineType,
      dual_run_enabled: dualRunEnabled,
      sampling_rate: samplingRate,
    };
  }
  
  createExecutionCompleteEvent(
    request: ExecRequest,
    result: ExecResult,
    engineVersion: string,
    engineType: string,
    dualRunPerformed: boolean,
    dualRunMatch?: boolean
  ): ExecutionCompleteEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.EXECUTION_COMPLETE,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: request.requestId,
      tenant_id: this.deriveTenantId(request),
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      algorithm: request.params.algorithm,
      engine_type: engineType,
      fingerprint: result.fingerprint,
      confidence: this.calculateConfidence(result),
      duration_ms: result.meta.durationMs,
      status: result.status,
      recommended_action_hash: this.hashAction(result.recommendedAction),
      dual_run_performed: dualRunPerformed,
      ...(dualRunMatch !== undefined && { dual_run_match: dualRunMatch }),
      action_count: request.params.actions.length,
      state_count: request.params.states.length,
    };
  }
  
  createExecutionErrorEvent(
    request: ExecRequest,
    errorCode: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    retryable: boolean,
    engineType: string,
    engineVersion: string,
    fallbackEngine?: string
  ): ExecutionErrorEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.EXECUTION_ERROR,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: request.requestId,
      tenant_id: this.deriveTenantId(request),
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      error_code: errorCode,
      severity,
      retryable,
      engine_type: engineType,
      ...(fallbackEngine && { fallback_engine: fallbackEngine }),
    };
  }
  
  createEngineSwitchEvent(
    requestId: string,
    tenantId: string,
    fromEngine: string,
    toEngine: string,
    reason: string,
    forced: boolean,
    engineVersion: string
  ): EngineSwitchEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.ENGINE_SWITCH,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: requestId,
      tenant_id: tenantId,
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      from_engine: fromEngine,
      to_engine: toEngine,
      reason,
      forced,
    };
  }
  
  createDualRunMismatchEvent(
    requestId: string,
    tenantId: string,
    primaryEngine: string,
    secondaryEngine: string,
    differenceCount: number,
    differenceTypes: string[],
    fingerprintMatch: boolean,
    engineVersion: string
  ): DualRunMismatchEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.DUAL_RUN_MISMATCH,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: requestId,
      tenant_id: tenantId,
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      primary_engine: primaryEngine,
      secondary_engine: secondaryEngine,
      difference_count: differenceCount,
      difference_types: differenceTypes,
      fingerprint_match: fingerprintMatch,
    };
  }
  
  createPolicyViolationEvent(
    requestId: string,
    tenantId: string,
    policyRuleId: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    action: 'allow' | 'deny' | 'quarantine',
    engineVersion: string
  ): PolicyViolationEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.POLICY_VIOLATION,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: requestId,
      tenant_id: tenantId,
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      policy_rule_id: policyRuleId,
      severity,
      action,
    };
  }
  
  createRollbackEvent(
    requestId: string,
    tenantId: string,
    fromEngine: string,
    toEngine: string,
    reason: string,
    success: boolean,
    engineVersion: string
  ): RollbackEvent {
    return {
      schema_version: EVENT_SCHEMA_VERSION,
      event_type: ControlPlaneEventType.ROLLBACK,
      timestamp: new Date().toISOString(),
      event_id: this.generateEventId(),
      request_id: requestId,
      tenant_id: tenantId,
      engine_version: engineVersion,
      contract_version: this.contractVersion,
      protocol_version: this.protocolVersion,
      from_engine: fromEngine,
      to_engine: toEngine,
      reason,
      success,
    };
  }
  
  // ============================================================================
  // Export Methods
  // ============================================================================
  
  /**
   * Export an event to the JSONL stream
   */
  exportEvent(event: AnyControlPlaneEvent): void {
    try {
      const jsonlLine = JSON.stringify(event) + '\n';
      
      // Check if we need to rotate files
      if (this.currentFileSize + jsonlLine.length > this.config.maxFileSize) {
        this.rotateFile();
      }
      
      // Ensure we have a current file
      if (!this.currentFile) {
        this.currentFile = this.generateFilePath();
      }
      
      // Append to file
      appendFileSync(this.currentFile, jsonlLine);
      this.currentFileSize += jsonlLine.length;
    } catch (error) {
      // Fail silently - event export must not break execution
      console.error('[EventExport] Failed to export event:', error);
    }
  }
  
  /**
   * Export multiple events in batch
   */
  exportEvents(events: AnyControlPlaneEvent[]): void {
    for (const event of events) {
      this.exportEvent(event);
    }
  }
  
  // ============================================================================
  // Private Helpers
  // ============================================================================
  
  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputPath)) {
      mkdirSync(this.config.outputPath, { recursive: true });
    }
  }
  
  private generateFilePath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const counter = String(this.fileCounter++).padStart(4, '0');
    return join(this.config.outputPath, `events-${timestamp}-${counter}.jsonl`);
  }
  
  private rotateFile(): void {
    this.currentFile = this.generateFilePath();
    this.currentFileSize = 0;
    this.cleanupOldFiles();
  }
  
  private cleanupOldFiles(): void {
    try {
      const { readdirSync, statSync, unlinkSync } = require('fs');
      
      const files = readdirSync(this.config.outputPath)
        .filter((f: string) => f.endsWith('.jsonl'))
        .map((f: string) => ({
          name: f,
          path: join(this.config.outputPath, f),
          mtime: statSync(join(this.config.outputPath, f)).mtime,
        }))
        .sort((a: { mtime: Date }, b: { mtime: Date }) => b.mtime.getTime() - a.mtime.getTime());
      
      // Remove old files beyond maxFiles limit
      for (const file of files.slice(this.config.maxFiles)) {
        try {
          unlinkSync(file.path);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${random}`;
  }
  
  private deriveTenantId(request: ExecRequest): string {
    const metadata = (request as unknown as Record<string, unknown>).metadata;
    if (metadata && typeof metadata === 'object' && 'tenantId' in metadata) {
      const tenantId = String(metadata.tenantId);
      // Hash tenant ID to avoid PII leakage
      return createHash('sha256').update(tenantId).digest('hex').slice(0, 16);
    }
    
    // Derive from requestId
    return createHash('sha256').update(request.requestId).digest('hex').slice(0, 16);
  }
  
  private calculateConfidence(result: ExecResult): number {
    // Simple confidence heuristic based on result quality
    if (result.status !== 'success') return 0;
    if (!result.fingerprint) return 0.5;
    if (result.ranking.length === 0) return 0.5;
    return 0.95; // Default high confidence for successful results
  }
  
  private hashAction(action: string): string {
    // Hash the action to avoid leaking sensitive action names
    return createHash('sha256').update(action).digest('hex').slice(0, 16);
  }
}

// Singleton instance
let exporterInstance: ControlPlaneEventExporter | undefined;

/**
 * Get or create the singleton event exporter
 */
export function getEventExporter(config?: Partial<EventExportConfig>): ControlPlaneEventExporter {
  if (!exporterInstance) {
    exporterInstance = new ControlPlaneEventExporter(config);
  }
  return exporterInstance;
}

/**
 * Reset the event exporter (for testing)
 */
export function resetEventExporter(): void {
  exporterInstance = undefined;
}
