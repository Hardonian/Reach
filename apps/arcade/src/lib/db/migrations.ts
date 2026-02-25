// @ts-ignore
import Database from "better-sqlite3";

export const MIGRATIONS: string[] = [
  /* 001 — core multi-tenant schema */
  `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    deleted_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TEXT NOT NULL,
    UNIQUE(tenant_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    key_hash    TEXT NOT NULL UNIQUE,
    key_prefix  TEXT NOT NULL,
    name        TEXT NOT NULL,
    scopes      TEXT NOT NULL DEFAULT '[]',
    last_used_at TEXT,
    expires_at  TEXT,
    created_at  TEXT NOT NULL,
    revoked_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS web_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    tenant_id   TEXT,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions(user_id);
  `,

  /* 002 — workflows + runs */
  `
  CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    project_id  TEXT REFERENCES projects(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    graph_json  TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    version     INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'draft',
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    workflow_id  TEXT NOT NULL REFERENCES workflows(id),
    status       TEXT NOT NULL DEFAULT 'queued',
    inputs_json  TEXT NOT NULL DEFAULT '{}',
    outputs_json TEXT NOT NULL DEFAULT '{}',
    metrics_json TEXT NOT NULL DEFAULT '{}',
    error        TEXT,
    started_at   TEXT,
    finished_at  TEXT,
    created_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
  `,

  /* 003 — packs + marketplace */
  `
  CREATE TABLE IF NOT EXISTS packs (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT REFERENCES tenants(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'general',
    visibility      TEXT NOT NULL DEFAULT 'public',
    latest_version  TEXT NOT NULL DEFAULT '0.0.0',
    author_id       TEXT REFERENCES users(id),
    author_name     TEXT NOT NULL DEFAULT '',
    verified        INTEGER NOT NULL DEFAULT 0,
    security_status TEXT NOT NULL DEFAULT 'pending',
    reputation_score INTEGER NOT NULL DEFAULT 0,
    downloads       INTEGER NOT NULL DEFAULT 0,
    rating_sum      REAL NOT NULL DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    tools_json      TEXT NOT NULL DEFAULT '[]',
    tags_json       TEXT NOT NULL DEFAULT '[]',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    data_handling   TEXT NOT NULL DEFAULT 'minimal',
    flagged         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    deleted_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS pack_versions (
    id          TEXT PRIMARY KEY,
    pack_id     TEXT NOT NULL REFERENCES packs(id),
    version     TEXT NOT NULL,
    manifest_json TEXT NOT NULL DEFAULT '{}',
    readme      TEXT NOT NULL DEFAULT '',
    changelog   TEXT NOT NULL DEFAULT '',
    immutable   INTEGER NOT NULL DEFAULT 1,
    published_at TEXT NOT NULL,
    UNIQUE(pack_id, version)
  );

  CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id          TEXT PRIMARY KEY,
    pack_id     TEXT NOT NULL REFERENCES packs(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    rating      INTEGER NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    UNIQUE(pack_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_packs_tenant ON packs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_packs_category ON packs(category);
  CREATE INDEX IF NOT EXISTS idx_packs_visibility ON packs(visibility);
  CREATE INDEX IF NOT EXISTS idx_pack_versions_pack ON pack_versions(pack_id);
  `,

  /* 004 — billing + entitlements + audit */
  `
  CREATE TABLE IF NOT EXISTS entitlements (
    id                    TEXT PRIMARY KEY,
    tenant_id             TEXT NOT NULL UNIQUE REFERENCES tenants(id),
    plan                  TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id       TEXT,
    status                TEXT NOT NULL DEFAULT 'active',
    runs_per_month        INTEGER NOT NULL DEFAULT 100,
    runs_used_this_month  INTEGER NOT NULL DEFAULT 0,
    pack_limit            INTEGER NOT NULL DEFAULT 5,
    retention_days        INTEGER NOT NULL DEFAULT 7,
    period_start          TEXT,
    period_end            TEXT,
    updated_at            TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id              TEXT PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL,
    payload_json    TEXT NOT NULL,
    processed       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL,
    user_id     TEXT,
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    ip_address  TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telemetry_rollups (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    pack_id     TEXT,
    workflow_id TEXT,
    period      TEXT NOT NULL,
    runs_count  INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms REAL NOT NULL DEFAULT 0,
    p95_duration_ms REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    UNIQUE(tenant_id, pack_id, workflow_id, period)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_entitlements_stripe ON entitlements(stripe_customer_id);
  CREATE INDEX IF NOT EXISTS idx_telemetry_tenant ON telemetry_rollups(tenant_id, period);
  `,

  /* 005 — analytics events */
  `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event       TEXT NOT NULL,
    properties_json TEXT NOT NULL DEFAULT '{}',
    ts          TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics_events(ts);
  CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
  `,

  /* 006 — onboarding progress */
  `
  CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id     TEXT NOT NULL,
    step_id     TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, step_id)
  );
  `,

  /* 007 — release gates + github installations */
  `
  CREATE TABLE IF NOT EXISTS gates (
    id               TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id),
    name             TEXT NOT NULL,
    repo_provider    TEXT NOT NULL DEFAULT 'github',
    repo_owner       TEXT NOT NULL,
    repo_name        TEXT NOT NULL,
    default_branch   TEXT NOT NULL DEFAULT 'main',
    trigger_types    TEXT NOT NULL DEFAULT '["pr","push"]',
    required_checks  TEXT NOT NULL DEFAULT '[]',
    thresholds       TEXT NOT NULL DEFAULT '{"pass_rate":1.0,"max_violations":0}',
    status           TEXT NOT NULL DEFAULT 'enabled',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gate_runs (
    id                   TEXT PRIMARY KEY,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id),
    gate_id              TEXT NOT NULL REFERENCES gates(id),
    workflow_run_id      TEXT REFERENCES workflow_runs(id),
    status               TEXT NOT NULL DEFAULT 'running',
    trigger_type         TEXT NOT NULL DEFAULT 'manual',
    commit_sha           TEXT,
    pr_number            INTEGER,
    branch               TEXT,
    report_json          TEXT NOT NULL DEFAULT '{}',
    github_check_run_id  INTEGER,
    created_at           TEXT NOT NULL,
    finished_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS github_installations (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    installation_id INTEGER,
    access_token    TEXT,
    token_expires_at TEXT,
    repo_owner      TEXT NOT NULL,
    repo_name       TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_gates_tenant ON gates(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_gate_runs_gate ON gate_runs(gate_id);
  CREATE INDEX IF NOT EXISTS idx_gate_runs_tenant ON gate_runs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_github_installs_tenant ON github_installations(tenant_id);
  `,

  /* 008 — CI ingest runs */
  `
  CREATE TABLE IF NOT EXISTS ci_ingest_runs (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    workspace_key   TEXT,
    commit_sha      TEXT,
    branch          TEXT,
    pr_number       INTEGER,
    actor           TEXT,
    ci_provider     TEXT NOT NULL DEFAULT 'github',
    artifacts_json  TEXT NOT NULL DEFAULT '{}',
    run_metadata    TEXT NOT NULL DEFAULT '{}',
    gate_run_id     TEXT REFERENCES gate_runs(id),
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ci_ingest_tenant ON ci_ingest_runs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_ci_ingest_gate ON ci_ingest_runs(gate_run_id);
  `,

  /* 009 — signals + monitor runs + alert rules */
  `
  CREATE TABLE IF NOT EXISTS signals (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'drift',
    source          TEXT NOT NULL DEFAULT 'webhook',
    threshold_json  TEXT NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'enabled',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monitor_runs (
    id               TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id),
    signal_id        TEXT NOT NULL REFERENCES signals(id),
    value            REAL NOT NULL DEFAULT 0,
    metadata_json    TEXT NOT NULL DEFAULT '{}',
    alert_triggered  INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_rules (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    signal_id    TEXT REFERENCES signals(id),
    name         TEXT NOT NULL,
    channel      TEXT NOT NULL DEFAULT 'email',
    destination  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'enabled',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_signals_tenant ON signals(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_monitor_runs_signal ON monitor_runs(signal_id);
  CREATE INDEX IF NOT EXISTS idx_monitor_runs_tenant ON monitor_runs(tenant_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
  `,

  /* 010 — scenarios + scenario runs + report shares */
  `
  CREATE TABLE IF NOT EXISTS scenarios (
    id                   TEXT PRIMARY KEY,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id),
    name                 TEXT NOT NULL,
    base_run_id          TEXT REFERENCES workflow_runs(id),
    variants_json        TEXT NOT NULL DEFAULT '[]',
    compare_metrics_json TEXT NOT NULL DEFAULT '["pass_rate","latency","cost"]',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenario_runs (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    scenario_id  TEXT NOT NULL REFERENCES scenarios(id),
    status       TEXT NOT NULL DEFAULT 'running',
    results_json TEXT NOT NULL DEFAULT '[]',
    recommendation TEXT,
    created_at   TEXT NOT NULL,
    finished_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS report_shares (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id),
    resource_type TEXT NOT NULL,
    resource_id   TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    expires_at    TEXT,
    created_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scenarios_tenant ON scenarios(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_scenario_runs_scenario ON scenario_runs(scenario_id);
  CREATE INDEX IF NOT EXISTS idx_report_shares_slug ON report_shares(slug);
  `,

  /* 011 — schema hardening: versioning, audit trails, integrity */
  `
  -- Versioned skills table
  CREATE TABLE IF NOT EXISTS skills (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT '1.0.0',
    version_history TEXT NOT NULL DEFAULT '[]',
    config_json     TEXT NOT NULL DEFAULT '{}',
    config_hash     TEXT NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TEXT NOT NULL,
    created_by      TEXT NOT NULL REFERENCES users(id),
    updated_at      TEXT NOT NULL,
    updated_by      TEXT NOT NULL REFERENCES users(id),
    deleted_at      TEXT,
    deleted_by      TEXT
  );

  -- Versioned templates table
  CREATE TABLE IF NOT EXISTS templates (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT '1.0.0',
    version_history TEXT NOT NULL DEFAULT '[]',
    prompt_template TEXT NOT NULL,
    prompt_hash     TEXT NOT NULL DEFAULT '{}',
    variables_json  TEXT NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TEXT NOT NULL,
    created_by      TEXT NOT NULL REFERENCES users(id),
    updated_at      TEXT NOT NULL,
    updated_by      TEXT NOT NULL REFERENCES users(id),
    deleted_at      TEXT,
    deleted_by      TEXT
  );

  -- Run output snapshots (immutable)
  CREATE TABLE IF NOT EXISTS run_output_snapshots (
    id                TEXT PRIMARY KEY,
    run_id            TEXT NOT NULL REFERENCES workflow_runs(id),
    snapshot_version  TEXT NOT NULL DEFAULT '1.0.0',
    outputs_json      TEXT NOT NULL,
    outputs_hash      TEXT NOT NULL,
    metrics_json      TEXT NOT NULL,
    metrics_hash      TEXT NOT NULL,
    tool_calls_json   TEXT NOT NULL DEFAULT '[]',
    tool_calls_hash   TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    immutable         INTEGER NOT NULL DEFAULT 1
  );

  -- Tool execution audit trail
  CREATE TABLE IF NOT EXISTS tool_audit_trail (
    id                    TEXT PRIMARY KEY,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id),
    run_id                TEXT NOT NULL REFERENCES workflow_runs(id),
    tool_name             TEXT NOT NULL,
    tool_version          TEXT,
    invocation_id         TEXT NOT NULL,
    input_hash            TEXT NOT NULL,
    output_hash           TEXT,
    execution_time_ms     INTEGER NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'pending',
    error_message         TEXT,
    permission_scope_json TEXT NOT NULL DEFAULT '[]',
    rate_limit_key        TEXT,
    circuit_breaker_state TEXT,
    created_at            TEXT NOT NULL
  );

  -- Provider health tracking
  CREATE TABLE IF NOT EXISTS provider_health (
    id              TEXT PRIMARY KEY,
    provider_name   TEXT NOT NULL UNIQUE,
    health_score    REAL NOT NULL DEFAULT 1.0,
    latency_p50_ms  INTEGER NOT NULL DEFAULT 0,
    latency_p95_ms  INTEGER NOT NULL DEFAULT 0,
    latency_p99_ms  INTEGER NOT NULL DEFAULT 0,
    error_rate      REAL NOT NULL DEFAULT 0,
    last_success_at TEXT,
    last_failure_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'healthy',
    updated_at      TEXT NOT NULL
  );

  -- Score history for drift/regression tracking
  CREATE TABLE IF NOT EXISTS score_history (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    run_id          TEXT REFERENCES workflow_runs(id),
    score_type      TEXT NOT NULL,
    score_value     REAL NOT NULL,
    baseline_value  REAL,
    delta           REAL,
    metadata_json   TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL
  );

  -- Internal telemetry events
  CREATE TABLE IF NOT EXISTS internal_telemetry (
    id              TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    tenant_id       TEXT REFERENCES tenants(id),
    properties_json TEXT NOT NULL DEFAULT '{}',
    session_id      TEXT,
    created_at      TEXT NOT NULL
  );

  -- Plugin registry (scaffold)
  CREATE TABLE IF NOT EXISTS plugins (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    version         TEXT NOT NULL,
    plugin_type     TEXT NOT NULL,
    manifest_json   TEXT NOT NULL DEFAULT '{}',
    manifest_hash   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'inactive',
    compatibility_json TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_skills_tenant ON skills(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_run_snapshots_run ON run_output_snapshots(run_id);
  CREATE INDEX IF NOT EXISTS idx_tool_audit_run ON tool_audit_trail(run_id);
  CREATE INDEX IF NOT EXISTS idx_tool_audit_tenant ON tool_audit_trail(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_score_history_tenant ON score_history(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_score_history_type ON score_history(score_type, created_at);
  CREATE INDEX IF NOT EXISTS idx_internal_telemetry_type ON internal_telemetry(event_type, created_at);
  `,

  /* 012 — add audit columns to existing tables (backward compatible) */
  `
  -- Add audit columns to gates if missing
  ALTER TABLE gates ADD COLUMN created_by TEXT REFERENCES users(id);
  ALTER TABLE gates ADD COLUMN updated_by TEXT REFERENCES users(id);
  ALTER TABLE gates ADD COLUMN version TEXT DEFAULT '1.0.0';
  ALTER TABLE gates ADD COLUMN version_history TEXT DEFAULT '[]';
  ALTER TABLE gates ADD COLUMN config_hash TEXT DEFAULT '{}';
  ALTER TABLE gates ADD COLUMN deleted_at TEXT;
  ALTER TABLE gates ADD COLUMN deleted_by TEXT;

  -- Add audit columns to signals if missing
  ALTER TABLE signals ADD COLUMN created_by TEXT REFERENCES users(id);
  ALTER TABLE signals ADD COLUMN updated_by TEXT REFERENCES users(id);
  ALTER TABLE signals ADD COLUMN deleted_at TEXT;
  ALTER TABLE signals ADD COLUMN deleted_by TEXT;

  -- Add audit columns to scenarios if missing
  ALTER TABLE scenarios ADD COLUMN created_by TEXT REFERENCES users(id);
  ALTER TABLE scenarios ADD COLUMN updated_by TEXT REFERENCES users(id);
  ALTER TABLE scenarios ADD COLUMN deleted_at TEXT;
  ALTER TABLE scenarios ADD COLUMN deleted_by TEXT;

  -- Add integrity columns to workflow_runs
  ALTER TABLE workflow_runs ADD COLUMN outputs_hash TEXT;
  ALTER TABLE workflow_runs ADD COLUMN inputs_hash TEXT;
  ALTER TABLE workflow_runs ADD COLUMN snapshot_id TEXT REFERENCES run_output_snapshots(id);
  `,
  /* 013 — founder metrics + decision scoring */
  `
  -- Track the "AHA" moment (first success) directly on the user
  ALTER TABLE users ADD COLUMN first_success_at TEXT;

  -- Cache gate counts on tenants for faster dashboard rendering
  ALTER TABLE tenants ADD COLUMN active_gates_count INTEGER DEFAULT 0;

  -- Founder Decision Framework Ledger
  CREATE TABLE IF NOT EXISTS founder_decisions (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'draft', -- draft, go, defer, kill
    score_total       REAL NOT NULL DEFAULT 0,
    scores_json       TEXT NOT NULL DEFAULT '{}', -- activation, gate_leverage, monitoring, simulation, ecosystem, monetization, complexity, ui_expansion, engineering_load
    strategic_align   INTEGER NOT NULL DEFAULT 0,
    created_by        TEXT NOT NULL REFERENCES users(id),
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    deleted_at        TEXT
  );

  -- Track entropy signals per sprint/week
  CREATE TABLE IF NOT EXISTS entropy_snapshots (
    id                TEXT PRIMARY KEY,
    timestamp         TEXT NOT NULL,
    route_count       INTEGER NOT NULL,
    orphan_routes     INTEGER NOT NULL,
    avg_actions_per_screen REAL NOT NULL,
    paragraph_violations INTEGER NOT NULL,
    technical_debt_score REAL NOT NULL,
    created_at        TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_founder_decisions_status ON founder_decisions(status);
  CREATE INDEX IF NOT EXISTS idx_entropy_snapshots_ts ON entropy_snapshots(timestamp);
  `,

  /* 014 — Decision Pillar: Decision Reports, Junctions, Action Intents */
  `
  CREATE TABLE IF NOT EXISTS decision_reports (
    id                    TEXT PRIMARY KEY,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    workspace_id          TEXT,
    project_id            TEXT,
    source_type           TEXT NOT NULL DEFAULT 'manual',
    source_ref            TEXT NOT NULL,
    input_fingerprint     TEXT NOT NULL,
    decision_input        TEXT NOT NULL,
    decision_output       TEXT,
    decision_trace        TEXT,
    recommended_action_id TEXT,
    status               TEXT NOT NULL DEFAULT 'draft',
    outcome_status        TEXT NOT NULL DEFAULT 'unknown',
    outcome_notes        TEXT,
    outcome_timestamp    TEXT,
    calibration_delta    REAL,
    predicted_score      REAL,
    actual_score         REAL,
    governance_badges    TEXT,
    deleted_at           TEXT
  );
  
  CREATE TABLE IF NOT EXISTS junctions (
    id                   TEXT PRIMARY KEY,
    created_at           TEXT NOT NULL,
    type                 TEXT NOT NULL,
    severity_score       REAL NOT NULL DEFAULT 0,
    fingerprint          TEXT NOT NULL,
    trigger_source_ref   TEXT NOT NULL,
    trigger_data         TEXT NOT NULL DEFAULT '{}',
    trigger_trace        TEXT NOT NULL DEFAULT '[]',
    status               TEXT NOT NULL DEFAULT 'triggered',
    decision_id          TEXT,
    cooldown_until       TEXT,
    superseded_by        TEXT,
    deleted_at           TEXT
  );
  
  CREATE TABLE IF NOT EXISTS action_intents (
    id                   TEXT PRIMARY KEY,
    created_at           TEXT NOT NULL,
    decision_id           TEXT NOT NULL,
    action_id            TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending',
    notes                TEXT,
    executed_at          TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_decision_reports_status ON decision_reports(status);
  CREATE INDEX IF NOT EXISTS idx_decision_reports_source ON decision_reports(source_type, source_ref);
  CREATE INDEX IF NOT EXISTS idx_decision_reports_fingerprint ON decision_reports(input_fingerprint);
  CREATE INDEX IF NOT EXISTS idx_junctions_type ON junctions(type);
  CREATE INDEX IF NOT EXISTS idx_junctions_fingerprint ON junctions(fingerprint);
  CREATE INDEX IF NOT EXISTS idx_junctions_status ON junctions(status);
  CREATE INDEX IF NOT EXISTS idx_action_intents_decision ON action_intents(decision_id);
  `,

  /* 015 — governance control plane memory/spec/artifacts */
  `
  CREATE TABLE IF NOT EXISTS governance_memory (
    id           TEXT PRIMARY KEY,
    org_id       TEXT NOT NULL REFERENCES tenants(id),
    workspace_id TEXT NOT NULL,
    scope        TEXT NOT NULL DEFAULT 'global',
    memory_type  TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    confidence   REAL NOT NULL DEFAULT 0.5,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS governance_specs (
    id                  TEXT PRIMARY KEY,
    org_id              TEXT NOT NULL REFERENCES tenants(id),
    workspace_id        TEXT NOT NULL,
    scope               TEXT NOT NULL DEFAULT 'global',
    version             INTEGER NOT NULL,
    source_intent       TEXT NOT NULL,
    governance_plan_json TEXT NOT NULL DEFAULT '{}',
    spec_json           TEXT NOT NULL,
    spec_hash           TEXT NOT NULL,
    rollout_mode        TEXT NOT NULL DEFAULT 'dry-run',
    risk_summary_json   TEXT NOT NULL DEFAULT '[]',
    triggered_by        TEXT NOT NULL DEFAULT 'assistant',
    actor_user_id       TEXT,
    parent_spec_id      TEXT,
    replay_link         TEXT,
    created_at          TEXT NOT NULL,
    UNIQUE(org_id, workspace_id, scope, version)
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id           TEXT PRIMARY KEY,
    org_id       TEXT NOT NULL REFERENCES tenants(id),
    workspace_id TEXT NOT NULL,
    spec_id      TEXT REFERENCES governance_specs(id),
    artifact_type TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    content_text  TEXT NOT NULL,
    content_hash  TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_governance_memory_org_workspace ON governance_memory(org_id, workspace_id, scope, memory_type);
  CREATE INDEX IF NOT EXISTS idx_governance_specs_org_workspace ON governance_specs(org_id, workspace_id, scope, version DESC);
  CREATE INDEX IF NOT EXISTS idx_governance_specs_hash ON governance_specs(spec_hash);
  CREATE INDEX IF NOT EXISTS idx_artifacts_org_spec ON artifacts(org_id, spec_id, artifact_type);
  `,

  /* 016 — governance artifact provenance metadata */
  `
  ALTER TABLE artifacts ADD COLUMN source_intent TEXT;
  ALTER TABLE artifacts ADD COLUMN governance_plan_json TEXT;
  ALTER TABLE artifacts ADD COLUMN spec_hash TEXT;
  ALTER TABLE artifacts ADD COLUMN output_hash TEXT;
  ALTER TABLE artifacts ADD COLUMN engine_name TEXT;
  ALTER TABLE artifacts ADD COLUMN engine_version TEXT;
  ALTER TABLE artifacts ADD COLUMN actor_type TEXT;
  ALTER TABLE artifacts ADD COLUMN actor_user_id TEXT;
  ALTER TABLE artifacts ADD COLUMN triggered_by TEXT;

  CREATE INDEX IF NOT EXISTS idx_artifacts_org_spec_hash ON artifacts(org_id, workspace_id, spec_hash);
  `,

  /* 017 — RLS-like enforcement for multi-tenant isolation */
  `
  -- Session variables table to track current tenant context
  -- This table stores the "current" tenant_id for the session
  CREATE TABLE IF NOT EXISTS session_variables (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Initialize with empty tenant_id
  INSERT OR IGNORE INTO session_variables (key, value, updated_at) VALUES ('tenant_id', '', datetime('now'));

  -- Helper view to get current tenant_id easily
  CREATE VIEW IF NOT EXISTS current_tenant AS SELECT value as tenant_id FROM session_variables WHERE key = 'tenant_id';

  -- Function to set current tenant_id (to be called from application code)
  CREATE TRIGGER IF NOT EXISTS set_tenant_trigger
  INSTEAD OF UPDATE ON current_tenant
  BEGIN
    UPDATE session_variables SET value = NEW.tenant_id, updated_at = datetime('now') WHERE key = 'tenant_id';
  END;

  -- RLS Triggers for memberships table
  CREATE TRIGGER IF NOT EXISTS memberships_rls_insert
  BEFORE INSERT ON memberships
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into memberships for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS memberships_rls_update
  BEFORE UPDATE ON memberships
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update memberships from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS memberships_rls_delete
  BEFORE DELETE ON memberships
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete memberships from a different tenant')
    END;
  END;

  -- RLS Triggers for api_keys table
  CREATE TRIGGER IF NOT EXISTS api_keys_rls_insert
  BEFORE INSERT ON api_keys
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into api_keys for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS api_keys_rls_update
  BEFORE UPDATE ON api_keys
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update api_keys from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS api_keys_rls_delete
  BEFORE DELETE ON api_keys
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete api_keys from a different tenant')
    END;
  END;

  -- RLS Triggers for web_sessions table
  CREATE TRIGGER IF NOT EXISTS web_sessions_rls_insert
  BEFORE INSERT ON web_sessions
  WHEN NEW.tenant_id IS NOT NULL
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into web_sessions for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS web_sessions_rls_update
  BEFORE UPDATE ON web_sessions
  WHEN NEW.tenant_id IS NOT NULL
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id IS NOT NULL AND OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update web_sessions from a different tenant')
    END;
  END;

  -- RLS Triggers for projects table
  CREATE TRIGGER IF NOT EXISTS projects_rls_insert
  BEFORE INSERT ON projects
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into projects for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS projects_rls_update
  BEFORE UPDATE ON projects
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update projects from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS projects_rls_delete
  BEFORE DELETE ON projects
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete projects from a different tenant')
    END;
  END;

  -- RLS Triggers for workflows table
  CREATE TRIGGER IF NOT EXISTS workflows_rls_insert
  BEFORE INSERT ON workflows
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into workflows for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS workflows_rls_update
  BEFORE UPDATE ON workflows
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update workflows from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS workflows_rls_delete
  BEFORE DELETE ON workflows
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete workflows from a different tenant')
    END;
  END;

  -- RLS Triggers for workflow_runs table
  CREATE TRIGGER IF NOT EXISTS workflow_runs_rls_insert
  BEFORE INSERT ON workflow_runs
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into workflow_runs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS workflow_runs_rls_update
  BEFORE UPDATE ON workflow_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update workflow_runs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS workflow_runs_rls_delete
  BEFORE DELETE ON workflow_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete workflow_runs from a different tenant')
    END;
  END;

  -- RLS Triggers for gates table
  CREATE TRIGGER IF NOT EXISTS gates_rls_insert
  BEFORE INSERT ON gates
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into gates for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS gates_rls_update
  BEFORE UPDATE ON gates
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update gates from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS gates_rls_delete
  BEFORE DELETE ON gates
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete gates from a different tenant')
    END;
  END;

  -- RLS Triggers for gate_runs table
  CREATE TRIGGER IF NOT EXISTS gate_runs_rls_insert
  BEFORE INSERT ON gate_runs
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into gate_runs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS gate_runs_rls_update
  BEFORE UPDATE ON gate_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update gate_runs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS gate_runs_rls_delete
  BEFORE DELETE ON gate_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete gate_runs from a different tenant')
    END;
  END;

  -- RLS Triggers for signals table
  CREATE TRIGGER IF NOT EXISTS signals_rls_insert
  BEFORE INSERT ON signals
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into signals for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS signals_rls_update
  BEFORE UPDATE ON signals
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update signals from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS signals_rls_delete
  BEFORE DELETE ON signals
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete signals from a different tenant')
    END;
  END;

  -- RLS Triggers for monitor_runs table
  CREATE TRIGGER IF NOT EXISTS monitor_runs_rls_insert
  BEFORE INSERT ON monitor_runs
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into monitor_runs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS monitor_runs_rls_update
  BEFORE UPDATE ON monitor_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update monitor_runs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS monitor_runs_rls_delete
  BEFORE DELETE ON monitor_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete monitor_runs from a different tenant')
    END;
  END;

  -- RLS Triggers for alert_rules table
  CREATE TRIGGER IF NOT EXISTS alert_rules_rls_insert
  BEFORE INSERT ON alert_rules
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into alert_rules for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS alert_rules_rls_update
  BEFORE UPDATE ON alert_rules
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update alert_rules from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS alert_rules_rls_delete
  BEFORE DELETE ON alert_rules
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete alert_rules from a different tenant')
    END;
  END;

  -- RLS Triggers for scenarios table
  CREATE TRIGGER IF NOT EXISTS scenarios_rls_insert
  BEFORE INSERT ON scenarios
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into scenarios for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS scenarios_rls_update
  BEFORE UPDATE ON scenarios
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update scenarios from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS scenarios_rls_delete
  BEFORE DELETE ON scenarios
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete scenarios from a different tenant')
    END;
  END;

  -- RLS Triggers for scenario_runs table
  CREATE TRIGGER IF NOT EXISTS scenario_runs_rls_insert
  BEFORE INSERT ON scenario_runs
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into scenario_runs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS scenario_runs_rls_update
  BEFORE UPDATE ON scenario_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update scenario_runs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS scenario_runs_rls_delete
  BEFORE DELETE ON scenario_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete scenario_runs from a different tenant')
    END;
  END;

  -- RLS Triggers for entitlements table
  CREATE TRIGGER IF NOT EXISTS entitlements_rls_insert
  BEFORE INSERT ON entitlements
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into entitlements for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS entitlements_rls_update
  BEFORE UPDATE ON entitlements
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update entitlements from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS entitlements_rls_delete
  BEFORE DELETE ON entitlements
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete entitlements from a different tenant')
    END;
  END;

  -- RLS Triggers for audit_events table
  CREATE TRIGGER IF NOT EXISTS audit_events_rls_insert
  BEFORE INSERT ON audit_events
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into audit_events for a different tenant')
    END;
  END;

  -- RLS Triggers for ci_ingest_runs table
  CREATE TRIGGER IF NOT EXISTS ci_ingest_runs_rls_insert
  BEFORE INSERT ON ci_ingest_runs
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into ci_ingest_runs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS ci_ingest_runs_rls_update
  BEFORE UPDATE ON ci_ingest_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update ci_ingest_runs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS ci_ingest_runs_rls_delete
  BEFORE DELETE ON ci_ingest_runs
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete ci_ingest_runs from a different tenant')
    END;
  END;

  -- RLS Triggers for github_installations table
  CREATE TRIGGER IF NOT EXISTS github_installations_rls_insert
  BEFORE INSERT ON github_installations
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into github_installations for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS github_installations_rls_update
  BEFORE UPDATE ON github_installations
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update github_installations from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS github_installations_rls_delete
  BEFORE DELETE ON github_installations
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete github_installations from a different tenant')
    END;
  END;

  -- RLS Triggers for report_shares table
  CREATE TRIGGER IF NOT EXISTS report_shares_rls_insert
  BEFORE INSERT ON report_shares
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into report_shares for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS report_shares_rls_update
  BEFORE UPDATE ON report_shares
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update report_shares from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS report_shares_rls_delete
  BEFORE DELETE ON report_shares
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete report_shares from a different tenant')
    END;
  END;

  -- RLS Triggers for skills table
  CREATE TRIGGER IF NOT EXISTS skills_rls_insert
  BEFORE INSERT ON skills
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into skills for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS skills_rls_update
  BEFORE UPDATE ON skills
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update skills from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS skills_rls_delete
  BEFORE DELETE ON skills
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete skills from a different tenant')
    END;
  END;

  -- RLS Triggers for templates table
  CREATE TRIGGER IF NOT EXISTS templates_rls_insert
  BEFORE INSERT ON templates
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into templates for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS templates_rls_update
  BEFORE UPDATE ON templates
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update templates from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS templates_rls_delete
  BEFORE DELETE ON templates
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete templates from a different tenant')
    END;
  END;

  -- RLS Triggers for tool_audit_trail table
  CREATE TRIGGER IF NOT EXISTS tool_audit_trail_rls_insert
  BEFORE INSERT ON tool_audit_trail
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into tool_audit_trail for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS tool_audit_trail_rls_update
  BEFORE UPDATE ON tool_audit_trail
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update tool_audit_trail from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS tool_audit_trail_rls_delete
  BEFORE DELETE ON tool_audit_trail
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete tool_audit_trail from a different tenant')
    END;
  END;

  -- RLS Triggers for score_history table
  CREATE TRIGGER IF NOT EXISTS score_history_rls_insert
  BEFORE INSERT ON score_history
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into score_history for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS score_history_rls_update
  BEFORE UPDATE ON score_history
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update score_history from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS score_history_rls_delete
  BEFORE DELETE ON score_history
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete score_history from a different tenant')
    END;
  END;

  -- RLS Triggers for telemetry_rollups table
  CREATE TRIGGER IF NOT EXISTS telemetry_rollups_rls_insert
  BEFORE INSERT ON telemetry_rollups
  BEGIN
    SELECT CASE
      WHEN NEW.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into telemetry_rollups for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS telemetry_rollups_rls_update
  BEFORE UPDATE ON telemetry_rollups
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update telemetry_rollups from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS telemetry_rollups_rls_delete
  BEFORE DELETE ON telemetry_rollups
  BEGIN
    SELECT CASE
      WHEN OLD.tenant_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete telemetry_rollups from a different tenant')
    END;
  END;

  -- RLS Triggers for governance_memory table
  CREATE TRIGGER IF NOT EXISTS governance_memory_rls_insert
  BEFORE INSERT ON governance_memory
  BEGIN
    SELECT CASE
      WHEN NEW.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into governance_memory for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS governance_memory_rls_update
  BEFORE UPDATE ON governance_memory
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update governance_memory from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS governance_memory_rls_delete
  BEFORE DELETE ON governance_memory
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete governance_memory from a different tenant')
    END;
  END;

  -- RLS Triggers for governance_specs table
  CREATE TRIGGER IF NOT EXISTS governance_specs_rls_insert
  BEFORE INSERT ON governance_specs
  BEGIN
    SELECT CASE
      WHEN NEW.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into governance_specs for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS governance_specs_rls_update
  BEFORE UPDATE ON governance_specs
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update governance_specs from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS governance_specs_rls_delete
  BEFORE DELETE ON governance_specs
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete governance_specs from a different tenant')
    END;
  END;

  -- RLS Triggers for artifacts table
  CREATE TRIGGER IF NOT EXISTS artifacts_rls_insert
  BEFORE INSERT ON artifacts
  BEGIN
    SELECT CASE
      WHEN NEW.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot insert into artifacts for a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS artifacts_rls_update
  BEFORE UPDATE ON artifacts
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot update artifacts from a different tenant')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS artifacts_rls_delete
  BEFORE DELETE ON artifacts
  BEGIN
    SELECT CASE
      WHEN OLD.org_id != (SELECT value FROM session_variables WHERE key = 'tenant_id')
      THEN RAISE(ABORT, 'Tenant ID mismatch: cannot delete artifacts from a different tenant')
    END;
  END;
  `,
];

export function applyMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = db.prepare("SELECT version FROM schema_version").all() as {
    version: number;
  }[];
  const appliedSet = new Set(applied.map((r) => r.version));

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (!appliedSet.has(version)) {
      const applyMigration = db.transaction(() => {
        db.exec(MIGRATIONS[i]);
        db.prepare("INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)").run(
          version,
          new Date().toISOString(),
        );
      });
      applyMigration();
    }
  }
}

/**
 * Set the current tenant_id for the session.
 * This must be called before any tenant-specific operations.
 * 
 * @param db - The database connection
 * @param tenantId - The tenant ID to set for the current session (empty string to clear)
 */
export function setCurrentTenant(db: Database.Database, tenantId: string): void {
  db.prepare(`
    UPDATE session_variables 
    SET value = ?, updated_at = datetime('now') 
    WHERE key = 'tenant_id'
  `).run(tenantId);
}

/**
 * Get the current tenant_id for the session.
 * 
 * @param db - The database connection
 * @returns The current tenant ID, or empty string if not set
 */
export function getCurrentTenant(db: Database.Database): string {
  const result = db.prepare(`
    SELECT value FROM session_variables WHERE key = 'tenant_id'
  `).get() as { value: string } | undefined;
  return result?.value ?? '';
}

/**
 * Execute a function with a temporary tenant context.
 * Sets the tenant, runs the callback, then restores the previous tenant.
 * 
 * @param db - The database connection
 * @param tenantId - The tenant ID to set for this operation
 * @param fn - The function to execute within the tenant context
 * @returns The result of the function
 */
export function withTenantContext<T>(
  db: Database.Database,
  tenantId: string,
  fn: () => T
): T {
  const previousTenant = getCurrentTenant(db);
  try {
    setCurrentTenant(db, tenantId);
    return fn();
  } finally {
    setCurrentTenant(db, previousTenant);
  }
}
