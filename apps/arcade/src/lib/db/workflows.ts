import { getDB } from './connection';
import { newId } from './helpers';
import { type Project, type Workflow, type WorkflowRun } from './types';

// Projects
export function createProject(tenantId: string, name: string, description: string): Project {
  const db = getDB();
  const id = newId('prj');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects (id, tenant_id, name, description, created_at) VALUES (?,?,?,?,?)`)
    .run(id, tenantId, name, description, now);
  return getProject(id, tenantId)!;
}

export function getProject(id: string, tenantId: string): Project | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM projects WHERE id=? AND tenant_id=? AND deleted_at IS NULL').get(id, tenantId) as Project | undefined;
}

export function listProjects(tenantId: string): Project[] {
  const db = getDB();
  return db.prepare('SELECT * FROM projects WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC').all(tenantId) as Project[];
}

// Workflows
export function createWorkflow(tenantId: string, projectId: string | null, name: string, description: string, createdBy: string, graphJson: string): Workflow {
  const db = getDB();
  const id = newId('wfl');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workflows (id, tenant_id, project_id, name, description, graph_json, version, status, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,1,'draft',?,?,?)`)
    .run(id, tenantId, projectId ?? null, name, description, graphJson, createdBy, now, now);
  return getWorkflow(id, tenantId)!;
}

export function getWorkflow(id: string, tenantId: string): Workflow | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM workflows WHERE id=? AND tenant_id=? AND deleted_at IS NULL').get(id, tenantId) as Workflow | undefined;
}

export function updateWorkflow(id: string, tenantId: string, patch: { name?: string; description?: string; graphJson?: string; status?: string }): boolean {
  const db = getDB();
  const now = new Date().toISOString();
  db.prepare(`UPDATE workflows SET
    name=COALESCE(?,name), description=COALESCE(?,description),
    graph_json=COALESCE(?,graph_json), status=COALESCE(?,status),
    version=version+1, updated_at=?
    WHERE id=? AND tenant_id=?`)
    .run(patch.name ?? null, patch.description ?? null, patch.graphJson ?? null, patch.status ?? null, now, id, tenantId);
  return true;
}

export function listWorkflows(tenantId: string, projectId?: string): Workflow[] {
  const db = getDB();
  if (projectId) {
    return db.prepare('SELECT * FROM workflows WHERE tenant_id=? AND project_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(tenantId, projectId) as Workflow[];
  }
  return db.prepare('SELECT * FROM workflows WHERE tenant_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(tenantId) as Workflow[];
}

// Workflow Runs
export function createWorkflowRun(tenantId: string, workflowId: string, inputs: unknown): WorkflowRun {
  const db = getDB();
  const id = newId('run');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workflow_runs (id, tenant_id, workflow_id, status, inputs_json, outputs_json, metrics_json, created_at)
    VALUES (?,?,?,'queued',?,'{}','{}',?)`)
    .run(id, tenantId, workflowId, JSON.stringify(inputs), now);
  return getWorkflowRun(id, tenantId)!;
}

export function getWorkflowRun(id: string, tenantId: string): WorkflowRun | undefined {
  const db = getDB();
  return db.prepare('SELECT * FROM workflow_runs WHERE id=? AND tenant_id=?').get(id, tenantId) as WorkflowRun | undefined;
}

export function updateWorkflowRun(id: string, tenant_id: string, patch: Partial<WorkflowRun>): void {
  const db = getDB();
  db.prepare(`UPDATE workflow_runs SET
    status=COALESCE(?,status), outputs_json=COALESCE(?,outputs_json),
    metrics_json=COALESCE(?,metrics_json), error=COALESCE(?,error),
    started_at=COALESCE(?,started_at), finished_at=COALESCE(?,finished_at)
    WHERE id=? AND tenant_id=?`)
    .run(patch.status ?? null, patch.outputs_json ?? null, patch.metrics_json ?? null,
      patch.error ?? null, patch.started_at ?? null, patch.finished_at ?? null, id, tenant_id);
}

export function listWorkflowRuns(tenantId: string, workflowId?: string, limit = 50): WorkflowRun[] {
  const db = getDB();
  if (workflowId) {
    return db.prepare('SELECT * FROM workflow_runs WHERE tenant_id=? AND workflow_id=? ORDER BY created_at DESC LIMIT ?').all(tenantId, workflowId, limit) as WorkflowRun[];
  }
  return db.prepare('SELECT * FROM workflow_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit) as WorkflowRun[];
}
