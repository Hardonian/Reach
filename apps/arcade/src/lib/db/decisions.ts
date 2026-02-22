/**
 * Decision Report Data Model and Repository
 */

import { getDB } from './connection';
import { newId } from './helpers';

export interface DecisionReport {
  id: string;
  created_at: string;
  updated_at: string;
  scope_keys: string; // JSON string of scope keys (workspace/project etc.)
  source_type: 'diff' | 'drift' | 'policy' | 'trust' | 'manual';
  source_ref: string;
  input_fingerprint: string;
  decision_input: string; // JSON string
  decision_output: string | null; // JSON string
  decision_trace: string | null; // JSON string
  recommended_action_id: string | null;
  status: 'draft' | 'evaluated' | 'reviewed' | 'accepted' | 'rejected' | 'superseded';
  outcome_status: 'unknown' | 'success' | 'failure' | 'mixed';
  outcome_notes: string | null;
  calibration_delta: number | null;
}

export interface CreateDecisionReportInput {
  scope_keys?: Record<string, string>;
  source_type: 'diff' | 'drift' | 'policy' | 'trust' | 'manual';
  source_ref: string;
  input_fingerprint: string;
  decision_input: any;
  decision_output?: any;
  decision_trace?: any;
  recommended_action_id?: string;
  status?: 'draft' | 'evaluated' | 'reviewed' | 'accepted' | 'rejected' | 'superseded';
  outcome_status?: 'unknown' | 'success' | 'failure' | 'mixed';
  outcome_notes?: string;
  calibration_delta?: number;
}

export interface UpdateDecisionReportInput {
  scope_keys?: Record<string, string>;
  source_type?: 'diff' | 'drift' | 'policy' | 'trust' | 'manual';
  source_ref?: string;
  input_fingerprint?: string;
  decision_input?: any;
  decision_output?: any;
  decision_trace?: any;
  recommended_action_id?: string;
  status?: 'draft' | 'evaluated' | 'reviewed' | 'accepted' | 'rejected' | 'superseded';
  outcome_status?: 'unknown' | 'success' | 'failure' | 'mixed';
  outcome_notes?: string;
  calibration_delta?: number;
}

export class DecisionRepository {
  /**
   * Creates a new decision report
   */
  static create(input: CreateDecisionReportInput): DecisionReport {
    const db = getDB();
    const now = new Date().toISOString();
    const id = newId('decision');
    
    const decision: DecisionReport = {
      id,
      created_at: now,
      updated_at: now,
      scope_keys: JSON.stringify(input.scope_keys || {}),
      source_type: input.source_type,
      source_ref: input.source_ref,
      input_fingerprint: input.input_fingerprint,
      decision_input: JSON.stringify(input.decision_input),
      decision_output: input.decision_output ? JSON.stringify(input.decision_output) : null,
      decision_trace: input.decision_trace ? JSON.stringify(input.decision_trace) : null,
      recommended_action_id: input.recommended_action_id || null,
      status: input.status || 'draft',
      outcome_status: input.outcome_status || 'unknown',
      outcome_notes: input.outcome_notes || null,
      calibration_delta: input.calibration_delta || null,
    };

    const stmt = db.prepare(`
      INSERT INTO decision_reports (
        id, created_at, updated_at, scope_keys, source_type, source_ref,
        input_fingerprint, decision_input, decision_output, decision_trace,
        recommended_action_id, status, outcome_status, outcome_notes, calibration_delta
      ) VALUES (
        @id, @created_at, @updated_at, @scope_keys, @source_type, @source_ref,
        @input_fingerprint, @decision_input, @decision_output, @decision_trace,
        @recommended_action_id, @status, @outcome_status, @outcome_notes, @calibration_delta
      )
    `);

    stmt.run(decision);
    return decision;
  }

  /**
   * Finds a decision report by ID
   */
  static findById(id: string): DecisionReport | undefined {
    const db = getDB();
    return db.prepare('SELECT * FROM decision_reports WHERE id = ?').get(id) as DecisionReport | undefined;
  }

  /**
   * Finds decision reports by source type and source ref
   */
  static findBySource(sourceType: string, sourceRef: string): DecisionReport[] {
    const db = getDB();
    return db.prepare('SELECT * FROM decision_reports WHERE source_type = ? AND source_ref = ?').all(sourceType, sourceRef) as DecisionReport[];
  }

  /**
   * Finds decision reports by input fingerprint
   */
  static findByFingerprint(fingerprint: string): DecisionReport[] {
    const db = getDB();
    return db.prepare('SELECT * FROM decision_reports WHERE input_fingerprint = ?').all(fingerprint) as DecisionReport[];
  }

  /**
   * Updates a decision report
   */
  static update(id: string, input: UpdateDecisionReportInput): DecisionReport | undefined {
    const db = getDB();
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...(input.scope_keys !== undefined && { scope_keys: JSON.stringify(input.scope_keys) }),
      ...(input.source_type !== undefined && { source_type: input.source_type }),
      ...(input.source_ref !== undefined && { source_ref: input.source_ref }),
      ...(input.input_fingerprint !== undefined && { input_fingerprint: input.input_fingerprint }),
      ...(input.decision_input !== undefined && { decision_input: JSON.stringify(input.decision_input) }),
      ...(input.decision_output !== undefined && { decision_output: JSON.stringify(input.decision_output) }),
      ...(input.decision_trace !== undefined && { decision_trace: JSON.stringify(input.decision_trace) }),
      ...(input.recommended_action_id !== undefined && { recommended_action_id: input.recommended_action_id }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.outcome_status !== undefined && { outcome_status: input.outcome_status }),
      ...(input.outcome_notes !== undefined && { outcome_notes: input.outcome_notes }),
      ...(input.calibration_delta !== undefined && { calibration_delta: input.calibration_delta }),
    };

    // Build update query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = @${key}`)
      .join(', ');
    const query = `UPDATE decision_reports SET ${setClause} WHERE id = @id`;

    db.prepare(query).run({ ...updateData, id });
    return this.findById(id);
  }

  /**
   * Deletes a decision report (soft delete?)
   */
  static delete(id: string): boolean {
    const db = getDB();
    const result = db.prepare('DELETE FROM decision_reports WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Lists all decision reports with optional filtering and pagination
   */
  static list(options?: {
    sourceType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): DecisionReport[] {
    const db = getDB();
    let query = 'SELECT * FROM decision_reports';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.sourceType) {
      conditions.push('source_type = ?');
      params.push(options.sourceType);
    }

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    return db.prepare(query).all(...params) as DecisionReport[];
  }
}
