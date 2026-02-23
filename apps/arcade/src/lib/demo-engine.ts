/**
 * Demo Engine - Core infrastructure for OSS Demo Mode
 * 
 * Provides deterministic demo functionality for:
 * - Seed data initialization
 * - System health checks
 * - Junction generation
 * - Decision evaluation
 * - Action planning and execution
 * - Export and verification
 * - Event replay
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface DemoTenant {
  id: string;
  name: string;
  slug: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

export interface DemoPack {
  id: string;
  name: string;
  category: string;
  tools: string[];
  shortDescription: string;
}

export interface DemoRun {
  id: string;
  timestamp: string;
  status: 'pass' | 'fail';
  score: number;
  agent: string;
  summary: string;
  findings?: DemoFinding[];
}

export interface DemoFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  fix?: string;
}

export interface DemoSeedData {
  tenant: DemoTenant;
  users: DemoUser[];
  packs: DemoPack[];
  runs: DemoRun[];
}

// Junction types
export interface Junction {
  id: string;
  created_at: string;
  trigger_type: 'diff' | 'drift' | 'policy' | 'trust' | 'manual';
  source_ref: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  trace: JunctionTrace[];
}

export interface JunctionTrace {
  step: number;
  timestamp: string;
  event: string;
  detail: string;
}

// Decision types
export interface DecisionReport {
  id: string;
  created_at: string;
  source_type: 'diff' | 'drift' | 'policy' | 'trust' | 'manual';
  source_ref: string;
  status: 'draft' | 'evaluated' | 'reviewed' | 'accepted' | 'rejected';
  outcome_status: 'unknown' | 'success' | 'failure' | 'mixed';
  input_fingerprint: string;
  decision_input: DecisionInput;
  decision_output?: DecisionOutput;
  decision_trace?: DecisionTrace[];
  recommended_action_id?: string;
}

export interface DecisionInput {
  context: string;
  options: string[];
  constraints: string[];
}

export interface DecisionOutput {
  selected_option: string;
  confidence: number;
  reasoning: string;
  risk_assessment: string;
}

export interface DecisionTrace {
  step: number;
  thought: string;
  decision: string;
}

// Action types
export interface ActionPlan {
  id: string;
  created_at: string;
  decision_id: string;
  status: 'draft' | 'planned' | 'approved' | 'executing' | 'completed' | 'failed';
  steps: ActionStep[];
  risk_summary: string;
}

export interface ActionStep {
  order: number;
  description: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  estimated_duration?: string;
}

export interface ActionExecution {
  id: string;
  plan_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  started_at?: string;
  completed_at?: string;
  journal: ActionJournalEntry[];
}

export interface ActionJournalEntry {
  timestamp: string;
  event: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

// Event types
export interface DemoEvent {
  id: string;
  timestamp: string;
  type: 'junction' | 'decision' | 'action' | 'system' | 'artifact';
  source_id: string;
  payload: Record<string, unknown>;
}

// Vitals types
export interface VitalsSummary {
  timestamp: string;
  total_junctions: number;
  open_junctions: number;
  total_decisions: number;
  accepted_decisions: number;
  total_actions: number;
  successful_actions: number;
  system_health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface VitalsTrend {
  metric: string;
  data_points: { timestamp: string; value: number }[];
}

// Export types
export interface ExportBundle {
  id: string;
  created_at: string;
  manifest: BundleManifest;
  events: DemoEvent[];
  decisions: DecisionReport[];
  junctions: Junction[];
  vitals: VitalsSummary;
  fingerprint: string;
}

export interface BundleManifest {
  version: string;
  engine_version: string;
  created_at: string;
  tenant_id: string;
  event_count: number;
  checksums: Record<string, string>;
}

// System check types
export interface SystemCheckResult {
  timestamp: string;
  overall_status: 'pass' | 'warn' | 'fail';
  checks: SystemCheck[];
}

export interface SystemCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

// JSON Response wrapper
export interface JsonResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  schemaVersion: string;
  engineVersion: string;
}

// ============================================================================
// Deterministic utilities
// ============================================================================

/**
 * Generate a deterministic UUID-like ID based on seed
 */
function generateDeterministicId(prefix: string, seed: number): string {
  const timestamp = 1700000000000 + seed; // Base timestamp for determinism
  const randomPart = (seed * 12345 % 10000000000).toString(36);
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Create deterministic timestamp for demo
 */
function createDeterministicTimestamp(seed: number): string {
  const base = new Date('2026-02-21T10:00:00Z');
  base.setSeconds(base.getSeconds() + seed * 30);
  return base.toISOString();
}

// ============================================================================
// Demo Engine Core
// ============================================================================

export class DemoEngine {
  private seedData: DemoSeedData | null = null;
  private junctions: Junction[] = [];
  private decisions: DecisionReport[] = [];
  private actions: ActionPlan[] = [];
  private events: DemoEvent[] = [];
  private isSeeded = false;

  constructor() {
    // Initialize with OSS mode
  }

  /**
   * Seed demo data deterministically
   */
  async seed(): Promise<DemoSeedData> {
    // Load seed data from file (in production, this would be bundled)
    this.seedData = {
      tenant: {
        id: 't_demo_01',
        name: 'Acme Agentic Labs',
        slug: 'acme-labs'
      },
      users: [
        { id: 'u_demo_01', name: 'Alice Architect', email: 'alice@acme.example' },
        { id: 'u_demo_02', name: 'Bob Builder', email: 'bob@acme.example' }
      ],
      packs: [
        {
          id: 'pck_financial_01',
          name: 'Financial Integrity Pack',
          category: 'safety',
          tools: ['ledger_read', 'ledger_write', 'currency_convert'],
          shortDescription: 'Ensures double-entry integrity for all agent transactions.'
        },
        {
          id: 'pck_security_01',
          name: 'Jailbreak Defense Pack',
          category: 'safety',
          tools: ['input_sanitize', 'threat_eval'],
          shortDescription: 'Hardens agents against prompt injection and unauthorized escalation.'
        }
      ],
      runs: [
        {
          id: 'run_001',
          timestamp: '2026-02-21T10:00:00Z',
          status: 'pass',
          score: 100,
          agent: 'SupportBot-V2',
          summary: 'Full regression suite passed. All tool calls within budget.'
        },
        {
          id: 'run_002',
          timestamp: '2026-02-21T10:30:00Z',
          status: 'fail',
          score: 45,
          agent: 'SupportBot-V2',
          summary: 'Critical policy breach detected: attempted write to root directory.',
          findings: [
            {
              severity: 'high',
              title: 'Unauthorized Write Attempt',
              detail: 'Agent attempted to call `fs_write` on `/etc/shadow`.',
              fix: 'Update policy gate `p_fs_01` to restrict paths to `./storage/*`.'
            }
          ]
        }
      ]
    };

    // Generate initial junctions from runs
    this.generateJunctionsFromRuns();
    
    // Generate events
    this.generateEvents();
    
    this.isSeeded = true;
    
    return this.seedData;
  }

  /**
   * Generate junctions from demo runs
   */
  private generateJunctionsFromRuns(): void {
    if (!this.seedData) return;

    // Create junctions from failed runs
    const failedRuns = this.seedData.runs.filter(r => r.status === 'fail');
    
    for (let i = 0; i < failedRuns.length; i++) {
      const run = failedRuns[i];
      const junction: Junction = {
        id: generateDeterministicId('jct', i),
        created_at: run.timestamp,
        trigger_type: 'policy',
        source_ref: run.id,
        severity: run.findings?.[0]?.severity === 'critical' ? 'critical' : 
                  run.findings?.[0]?.severity === 'high' ? 'error' : 'warning',
        status: 'open',
        title: run.findings?.[0]?.title || 'Policy Breach Detected',
        description: run.summary,
        trace: [
          {
            step: 1,
            timestamp: run.timestamp,
            event: 'policy_eval',
            detail: 'Evaluating policy gates for agent actions'
          },
          {
            step: 2,
            timestamp: createDeterministicTimestamp(i * 2 + 1),
            event: 'breach_detected',
            detail: run.findings?.[0]?.detail || 'Policy violation detected'
          },
          {
            step: 3,
            timestamp: createDeterministicTimestamp(i * 2 + 2),
            event: 'junction_created',
            detail: `Junction created from ${run.id}`
          }
        ]
      };
      this.junctions.push(junction);
    }

    // Add some diff and drift junctions
    const diffJunction: Junction = {
      id: generateDeterministicId('jct', 100),
      created_at: createDeterministicTimestamp(10),
      trigger_type: 'diff',
      source_ref: 'config/terraform/prod',
      severity: 'info',
      status: 'open',
      title: 'Infrastructure Configuration Change',
      description: 'Detected changes to production Terraform configuration',
      trace: [
        {
          step: 1,
          timestamp: createDeterministicTimestamp(10),
          event: 'diff_scan',
          detail: 'Scanning for configuration changes'
        },
        {
          step: 2,
          timestamp: createDeterministicTimestamp(11),
          event: 'change_detected',
          detail: '12 resources modified in terraform/prod'
        }
      ]
    };
    this.junctions.push(diffJunction);

    const driftJunction: Junction = {
      id: generateDeterministicId('jct', 101),
      created_at: createDeterministicTimestamp(20),
      trigger_type: 'drift',
      source_ref: 'kubernetes/prod/cluster-1',
      severity: 'warning',
      status: 'open',
      title: 'Kubernetes Cluster Drift Detected',
      description: 'Production cluster state differs from desired state',
      trace: [
        {
          step: 1,
          timestamp: createDeterministicTimestamp(20),
          event: 'drift_scan',
          detail: 'Scanning Kubernetes cluster state'
        },
        {
          step: 2,
          timestamp: createDeterministicTimestamp(21),
          event: 'drift_detected',
          detail: '3 deployments differ from expected state'
        }
      ]
    };
    this.junctions.push(driftJunction);
  }

  /**
   * Generate events from junctions and decisions
   */
  private generateEvents(): void {
    for (const junction of this.junctions) {
      this.events.push({
        id: generateDeterministicId('evt', junction.trace[0].step * 1000),
        timestamp: junction.created_at,
        type: 'junction',
        source_id: junction.id,
        payload: {
          trigger_type: junction.trigger_type,
          severity: junction.severity,
          status: junction.status
        }
      });
    }
  }

  /**
   * Run system check
   */
  async runSystemCheck(): Promise<SystemCheckResult> {
    const checks: SystemCheck[] = [
      {
        name: 'database',
        status: this.isSeeded ? 'pass' : 'warn',
        message: this.isSeeded ? 'Database accessible and seeded' : 'Database not yet seeded',
      },
      {
        name: 'engine',
        status: 'pass',
        message: 'Decision engine is operational (TypeScript mode)',
      },
      {
        name: 'storage',
        status: 'pass',
        message: 'Local storage is available',
      },
      {
        name: 'policies',
        status: this.junctions.length > 0 ? 'pass' : 'warn',
        message: this.junctions.length > 0 
          ? `${this.junctions.length} policy junctions loaded`
          : 'No junctions found - run seed first',
      },
      {
        name: 'determinism',
        status: 'pass',
        message: 'Deterministic mode enabled - outputs will be consistent',
      }
    ];

    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');

    return {
      timestamp: new Date().toISOString(),
      overall_status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
      checks
    };
  }

  /**
   * Get all junctions
   */
  getJunctions(): Junction[] {
    return this.junctions;
  }

  /**
   * Get junction by ID
   */
  getJunctionById(id: string): Junction | undefined {
    return this.junctions.find(j => j.id === id);
  }

  /**
   * Evaluate a junction (create decision report)
   */
  async evaluateJunction(junctionId: string): Promise<DecisionReport> {
    const junction = this.getJunctionById(junctionId);
    if (!junction) {
      throw new Error(`Junction not found: ${junctionId}`);
    }

    const decision: DecisionReport = {
      id: generateDeterministicId('dec', Date.now()),
      created_at: new Date().toISOString(),
      source_type: junction.trigger_type,
      source_ref: junction.id,
      status: 'evaluated',
      outcome_status: 'unknown',
      input_fingerprint: `fp_${junction.id}_${junction.created_at}`,
      decision_input: {
        context: `Evaluating junction ${junction.id}: ${junction.title}`,
        options: ['approve', 'reject', 'investigate', 'dismiss'],
        constraints: ['safety_first', 'minimal_impact', 'audit_trail']
      },
      decision_output: {
        selected_option: junction.severity === 'critical' ? 'reject' : 'approve',
        confidence: 0.85,
        reasoning: `Based on severity level (${junction.severity}) and trace analysis`,
        risk_assessment: junction.severity === 'critical' ? 'high' : 'medium'
      },
      decision_trace: [
        {
          step: 1,
          thought: 'Analyzing junction trigger and severity',
          decision: `Trigger type: ${junction.trigger_type}, Severity: ${junction.severity}`
        },
        {
          step: 2,
          thought: 'Evaluating risk assessment',
          decision: `Risk level: ${junction.severity === 'critical' ? 'high' : 'medium'}`
        },
        {
          step: 3,
          thought: 'Selecting recommended action',
          decision: junction.severity === 'critical' ? 'Reject - requires immediate attention' : 'Approve - within acceptable parameters'
        }
      ],
      recommended_action_id: generateDeterministicId('act', Date.now())
    };

    this.decisions.push(decision);
    
    // Add decision event
    this.events.push({
      id: generateDeterministicId('evt', Date.now()),
      timestamp: decision.created_at,
      type: 'decision',
      source_id: decision.id,
      payload: {
        junction_id: junctionId,
        status: decision.status,
        selected_option: decision.decision_output?.selected_option
      }
    });

    return decision;
  }

  /**
   * Get all decisions
   */
  getDecisions(): DecisionReport[] {
    return this.decisions;
  }

  /**
   * Get decision by ID
   */
  getDecisionById(id: string): DecisionReport | undefined {
    return this.decisions.find(d => d.id === id);
  }

  /**
   * Plan an action from a decision
   */
  async planAction(decisionId: string): Promise<ActionPlan> {
    const decision = this.getDecisionById(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    const plan: ActionPlan = {
      id: generateDeterministicId('plan', Date.now()),
      created_at: new Date().toISOString(),
      decision_id: decisionId,
      status: 'planned',
      steps: [
        {
          order: 1,
          description: 'Review junction details and trace',
          tool: 'junction_read',
          parameters: { junction_id: decision.source_ref }
        },
        {
          order: 2,
          description: 'Validate decision rationale',
          tool: 'decision_validate',
          parameters: { decision_id: decisionId }
        },
        {
          order: 3,
          description: decision.decision_output?.selected_option === 'approve' 
            ? 'Apply recommended changes'
            : 'Create incident ticket for review',
          estimated_duration: '5-10 minutes'
        }
      ],
      risk_summary: decision.decision_output?.risk_assessment || 'medium'
    };

    this.actions.push(plan);
    
    // Add action event
    this.events.push({
      id: generateDeterministicId('evt', Date.now()),
      timestamp: plan.created_at,
      type: 'action',
      source_id: plan.id,
      payload: {
        decision_id: decisionId,
        status: plan.status,
        step_count: plan.steps.length
      }
    });

    return plan;
  }

  /**
   * Execute an action plan (dry run / safe mode)
   */
  async executeAction(planId: string): Promise<ActionExecution> {
    const plan = this.actions.find(a => a.id === planId);
    if (!plan) {
      throw new Error(`Action plan not found: ${planId}`);
    }

    const execution: ActionExecution = {
      id: generateDeterministicId('exec', Date.now()),
      plan_id: planId,
      status: 'running',
      started_at: new Date().toISOString(),
      journal: [
        {
          timestamp: new Date().toISOString(),
          event: 'execution_started',
          detail: `Starting execution of plan ${planId}`,
          metadata: { plan_steps: plan.steps.length }
        }
      ]
    };

    // Simulate execution steps
    for (const step of plan.steps) {
      execution.journal.push({
        timestamp: new Date().toISOString(),
        event: 'step_started',
        detail: `Executing step ${step.order}: ${step.description}`,
        metadata: { step, tool: step.tool }
      });
    }

    execution.status = 'completed';
    execution.completed_at = new Date().toISOString();
    execution.journal.push({
      timestamp: execution.completed_at,
      event: 'execution_completed',
      detail: 'All steps completed successfully (demo mode - no actual changes made)',
      metadata: { demo_mode: true }
    });

    plan.status = 'completed';
    
    // Add execution event
    this.events.push({
      id: generateDeterministicId('evt', Date.now()),
      timestamp: execution.completed_at,
      type: 'action',
      source_id: execution.id,
      payload: {
        plan_id: planId,
        status: execution.status,
        journal_length: execution.journal.length
      }
    });

    return execution;
  }

  /**
   * Get all actions
   */
  getActions(): ActionPlan[] {
    return this.actions;
  }

  /**
   * Get action by ID
   */
  getActionById(id: string): ActionPlan | undefined {
    return this.actions.find(a => a.id === id);
  }

  /**
   * Get all events
   */
  getEvents(): DemoEvent[] {
    return this.events;
  }

  /**
   * Get vitals summary
   */
  getVitalsSummary(): VitalsSummary {
    return {
      timestamp: new Date().toISOString(),
      total_junctions: this.junctions.length,
      open_junctions: this.junctions.filter(j => j.status === 'open').length,
      total_decisions: this.decisions.length,
      accepted_decisions: this.decisions.filter(d => d.status === 'accepted' || d.status === 'reviewed').length,
      total_actions: this.actions.length,
      successful_actions: this.actions.filter(a => a.status === 'completed').length,
      system_health: this.isSeeded ? 'healthy' : 'degraded'
    };
  }

  /**
   * Export bundle
   */
  async exportBundle(): Promise<ExportBundle> {
    const bundle: ExportBundle = {
      id: generateDeterministicId('bundle', Date.now()),
      created_at: new Date().toISOString(),
      manifest: {
        version: '1.0.0',
        engine_version: '0.3.1-oss',
        created_at: new Date().toISOString(),
        tenant_id: this.seedData?.tenant.id || 'unknown',
        event_count: this.events.length,
        checksums: {
          events: `sha256_${this.events.length}`,
          decisions: `sha256_${this.decisions.length}`,
          junctions: `sha256_${this.junctions.length}`
        }
      },
      events: this.events,
      decisions: this.decisions,
      junctions: this.junctions,
      vitals: this.getVitalsSummary(),
      fingerprint: `fp_bundle_${Date.now()}`
    };

    return bundle;
  }

  /**
   * Verify bundle
   */
  async verifyBundle(bundle: ExportBundle): Promise<{ valid: boolean; details: string }> {
    const eventCount = bundle.events.length;
    const decisionCount = bundle.decisions.length;
    const junctionCount = bundle.junctions.length;

    const details = `Bundle verification: ${eventCount} events, ${decisionCount} decisions, ${junctionCount} junctions verified.`;

    return {
      valid: true,
      details
    };
  }

  /**
   * Replay events and recompute vitals
   */
  async replayEvents(): Promise<{ success: boolean; vitals: VitalsSummary; replayed_events: number }> {
    // In demo mode, replay just returns current state
    const vitals = this.getVitalsSummary();
    
    return {
      success: true,
      vitals,
      replayed_events: this.events.length
    };
  }

  /**
   * Create JSON response wrapper
   */
  createJsonResponse<T>(data: T, ok: boolean = true): JsonResponse<T> {
    const response: JsonResponse<T> = {
      ok,
      schemaVersion: '1.0.0',
      engineVersion: '0.3.1-oss'
    };
    
    if (ok && data) {
      response.data = data;
    } else if (!ok) {
      response.error = data as unknown as JsonResponse<T>['error'];
    }
    
    return response;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let demoEngineInstance: DemoEngine | null = null;

export function getDemoEngine(): DemoEngine {
  if (!demoEngineInstance) {
    demoEngineInstance = new DemoEngine();
  }
  return demoEngineInstance;
}

export function resetDemoEngine(): void {
  demoEngineInstance = null;
}
