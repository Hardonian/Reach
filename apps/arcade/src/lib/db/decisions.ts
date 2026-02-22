/**
 * Decision Repository
 * 
 * Database access layer for Decision Pillar entities.
 * No direct SQL in route handlers - all access goes through here.
 */

import { getDB } from './connection';
import type { DecisionReport, Junction, ActionIntent, DecisionStatus, DecisionOutcomeStatus, DecisionSourceType } from './types';

/**
 * Generate a unique ID (deterministic-friendly, not UUID for non-fingerprint paths)
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// Decision Report Repository
// ============================================================================

export const decisionRepository = {
  /**
   * Create a new decision report
   */
  create(data: {
    workspaceId?: string;
    projectId?: string;
    sourceType: DecisionSourceType;
    sourceRef: string;
    inputFingerprint: string;
    decisionInput: string;
  }): DecisionReport {
    const db = getDB();
    const id = generateId('dec');
    const createdAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO decision_reports (
        id, created_at, updated_at,
        workspace_id, project_id,
        source_type, source_ref,
        input_fingerprint, decision_input,
        status, outcome_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unknown')
    `);
    
    stmt.run(
      id, createdAt, createdAt,
      data.workspaceId || null, data.projectId || null,
      data.sourceType, data.sourceRef,
      data.inputFingerprint, data.decisionInput
    );
    
    return this.getById(id)!;
  },
  
  /**
   * Get decision by ID
   */
  getById(id: string): DecisionReport | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM decision_reports WHERE id = ? AND deleted_at IS NULL');
    const row = stmt.get(id) as DecisionReport | undefined;
    return row || null;
  },
  
  /**
   * List decisions with filters
   */
  list(options: {
    status?: DecisionStatus;
    sourceType?: DecisionSourceType;
    workspaceId?: string;
    limit?: number;
    offset?: number;
  } = {}): { decisions: DecisionReport[]; total: number } {
    const db = getDB();
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    
    if (options.sourceType) {
      conditions.push('source_type = ?');
      params.push(options.sourceType);
    }
    
    if (options.workspaceId) {
      conditions.push('workspace_id = ?');
      params.push(options.workspaceId);
    }
    
    const where = conditions.join(' AND ');
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM decision_reports WHERE ${where}`);
    const { count } = countStmt.get(...params) as { count: number };
    
    // Get paginated results (sorted by created_at desc for deterministic order)
    const stmt = db.prepare(`
      SELECT * FROM decision_reports 
      WHERE ${where} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    const decisions = stmt.all(...params, limit, offset) as DecisionReport[];
    
    return { decisions, total: count };
  },
  
  /**
   * Update decision output (after engine evaluation)
   */
  updateOutput(id: string, output: {
    decisionOutput: string;
    decisionTrace: string;
    recommendedActionId?: string;
    governanceBadges?: string;
  }): DecisionReport | null {
    const db = getDatabase();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      UPDATE decision_reports SET
        decision_output = ?,
        decision_trace = ?,
        recommended_action_id = ?,
        governance_badges = ?,
        status = 'evaluated',
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(
      output.decisionOutput,
      output.decisionTrace,
      output.recommendedActionId || null,
      output.governanceBadges || null,
      updatedAt,
      id
    );
    
    return this.getById(id);
  },
  
  /**
   * Update decision status (lifecycle transition)
   */
  updateStatus(id: string, status: DecisionStatus): DecisionReport | null {
    const db = getDB();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      UPDATE decision_reports SET status = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(status, updatedAt, id);
    return this.getById(id);
  },
  
  /**
   * Record outcome
   */
  recordOutcome(id: string, outcome: {
    status: DecisionOutcomeStatus;
    notes?: string;
    actualScore?: number;
  }): DecisionReport | null {
    const db = getDB();
    const updatedAt = now();
    const outcomeTimestamp = now();
    
    // Calculate calibration delta if we have both predicted and actual
    const decision = this.getById(id);
    let calibrationDelta: number | null = null;
    
    if (decision && outcome.actualScore !== undefined) {
      const predictedScore = decision.predicted_score;
      if (predictedScore !== null) {
        calibrationDelta = outcome.actualScore - predictedScore;
      }
    }
    
    const stmt = db.prepare(`
      UPDATE decision_reports SET
        outcome_status = ?,
        outcome_notes = ?,
        outcome_timestamp = ?,
        actual_score = ?,
        calibration_delta = ?,
        status = CASE 
          WHEN ? = 'success' THEN 'accepted'
          WHEN ? = 'failure' THEN 'rejected'
          ELSE status
        END,
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(
      outcome.status,
      outcome.notes || null,
      outcomeTimestamp,
      outcome.actualScore || null,
      calibrationDelta,
      outcome.status,
      outcome.status,
      updatedAt,
      id
    );
    
    return this.getById(id);
  },
  
  /**
   * Get decision by fingerprint (for deduplication)
   */
  getByFingerprint(fingerprint: string): DecisionReport | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM decision_reports WHERE input_fingerprint = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(fingerprint) as DecisionReport | undefined;
    return row || null;
  },
  
  /**
   * Get metrics for dashboard
   */
  getMetrics(workspaceId?: string): {
    total: number;
    accepted: number;
    rejected: number;
    pending: number;
    successRate: number;
    regretRate: number;
  } {
    const db = getDatabase();
    let where = 'deleted_at IS NULL';
    const params: unknown[] = [];
    
    if (workspaceId) {
      where += ' AND workspace_id = ?';
      params.push(workspaceId);
    }
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status IN ('draft', 'evaluated', 'reviewed') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN outcome_status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN outcome_status = 'failure' THEN 1 ELSE 0 END) as failure_count
      FROM decision_reports
      WHERE ${where}
    `);
    
    const row = stmt.get(...params) as {
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
      success_count: number;
      failure_count: number;
    };
    
    const decided = row.accepted + row.rejected;
    return {
      total: row.total,
      accepted: row.accepted || 0,
      rejected: row.rejected || 0,
      pending: row.pending || 0,
      successRate: decided > 0 ? (row.accepted || 0) / decided : 0,
      regretRate: decided > 0 ? (row.failure_count || 0) / decided : 0,
    };
  },
};

// ============================================================================
// Junction Repository
// ============================================================================

export const junctionRepository = {
  /**
   * Create a new junction
   */
  create(data: {
    type: 'diff_critical' | 'drift_alert' | 'trust_drop' | 'policy_violation';
    severityScore: number;
    fingerprint: string;
    triggerSourceRef: string;
    triggerData: string;
    triggerTrace: string;
  }): Junction {
    const db = getDB();
    const id = generateId('jct');
    const createdAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO junctions (
        id, created_at,
        type, severity_score, fingerprint,
        trigger_source_ref, trigger_data, trigger_trace,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'triggered')
    `);
    
    stmt.run(
      id, createdAt,
      data.type, data.severityScore, data.fingerprint,
      data.triggerSourceRef, data.triggerData, data.triggerTrace
    );
    
    return this.getById(id)!;
  },
  
  /**
   * Get junction by ID
   */
  getById(id: string): Junction | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM junctions WHERE id = ? AND deleted_at IS NULL');
    const row = stmt.get(id) as Junction | undefined;
    return row || null;
  },
  
  /**
   * List junctions with filters
   */
  list(options: {
    type?: string;
    status?: string;
    since?: string;
    limit?: number;
    offset?: number;
  } = {}): { junctions: Junction[]; total: number } {
    const db = getDB();
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    
    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    
    if (options.since) {
      conditions.push('created_at >= ?');
      params.push(options.since);
    }
    
    const where = conditions.join(' AND ');
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM junctions WHERE ${where}`);
    const { count } = countStmt.get(...params) as { count: number };
    
    // Get paginated results (sorted by severity desc, then created_at desc)
    const stmt = db.prepare(`
      SELECT * FROM junctions 
      WHERE ${where} 
      ORDER BY severity_score DESC, created_at DESC 
      LIMIT ? OFFSET ?
    `);
    const junctions = stmt.all(...params, limit, offset) as Junction[];
    
    return { junctions, total: count };
  },
  
  /**
   * Check for existing junction with same fingerprint (deduplication)
   */
  getByFingerprint(fingerprint: string): Junction | null {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM junctions 
      WHERE fingerprint = ? 
        AND deleted_at IS NULL 
        AND (cooldown_until IS NULL OR cooldown_until < ?)
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const row = stmt.get(fingerprint, now()) as Junction | undefined;
    return row || null;
  },
  
  /**
   * Update junction status
   */
  updateStatus(id: string, status: 'triggered' | 'acknowledged' | 'resolved' | 'superseded'): Junction | null {
    const db = getDB();
    
    const stmt = db.prepare(`
      UPDATE junctions SET status = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(status, id);
    return this.getById(id);
  },
  
  /**
   * Link junction to decision
   */
  linkToDecision(junctionId: string, decisionId: string): Junction | null {
    const db = getDB();
    
    const stmt = db.prepare(`
      UPDATE junctions SET decision_id = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(decisionId, junctionId);
    return this.getById(junctionId);
  },
  
  /**
   * Set cooldown period for deduplication
   */
  setCooldown(id: string, cooldownMinutes: number): Junction | null {
    const db = getDB();
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      UPDATE junctions SET cooldown_until = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    stmt.run(cooldownUntil, id);
    return this.getById(id);
  },
};

// ============================================================================
// Action Intent Repository
// ============================================================================

export const actionIntentRepository = {
  /**
   * Create action intent (when user accepts a decision)
   */
  create(data: {
    decisionId: string;
    actionId: string;
    notes?: string;
  }): ActionIntent {
    const db = getDB();
    const id = generateId('act');
    const createdAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO action_intents (
        id, created_at,
        decision_id, action_id,
        status, notes
      ) VALUES (?, ?, ?, ?, 'pending', ?)
    `);
    
    stmt.run(id, createdAt, data.decisionId, data.actionId, data.notes || null);
    
    return this.getById(id)!;
  },
  
  /**
   * Get action intent by ID
   */
  getById(id: string): ActionIntent | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM action_intents WHERE id = ?');
    const row = stmt.get(id) as ActionIntent | undefined;
    return row || null;
  },
  
  /**
   * Get action intents by decision ID
   */
  getByDecisionId(decisionId: string): ActionIntent[] {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM action_intents WHERE decision_id = ? ORDER BY created_at DESC');
    return stmt.all(decisionId) as ActionIntent[];
  },
  
  /**
   * Update action intent status
   */
  updateStatus(id: string, status: 'pending' | 'executed' | 'cancelled' | 'failed'): ActionIntent | null {
    const db = getDB();
    const executedAt = status === 'executed' ? now() : null;
    
    const stmt = db.prepare(`
      UPDATE action_intents SET status = ?, executed_at = ?
      WHERE id = ?
    `);
    
    stmt.run(status, executedAt, id);
    return this.getById(id);
  },
};
