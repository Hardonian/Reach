// @ts-ignore
import Database from 'better-sqlite3';

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
];

export function applyMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = db.prepare('SELECT version FROM schema_version').all() as { version: number }[];
  const appliedSet = new Set(applied.map((r) => r.version));

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (!appliedSet.has(version)) {
      const applyMigration = db.transaction(() => {
        db.exec(MIGRATIONS[i]);
        db.prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
          version,
          new Date().toISOString()
        );
      });
      applyMigration();
    }
  }
}
