package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
)

// SQLiteStore implements the persistence layer for Reach.
type SQLiteStore struct {
	db *sql.DB
}

// RunRecord represents a single execution run.
type RunRecord struct {
	ID           string
	TenantID     string
	Status       string
	Capabilities []string
	CreatedAt    time.Time
	PackCID      string
}

// EventRecord represents a discrete event in the execution stream.
type EventRecord struct {
	RunID     string
	Type      string
	Payload   []byte
	CreatedAt time.Time
}

// AuditRecord represents a compliance or security audit log entry.
type AuditRecord struct {
	TenantID  string
	RunID     string
	Type      string
	Payload   []byte
	CreatedAt time.Time
}

// NewSQLiteStore initializes the database and runs migrations.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	s := &SQLiteStore{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return s, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *SQLiteStore) migrate() error {
	query := `
	CREATE TABLE IF NOT EXISTS runs (
		id TEXT PRIMARY KEY,
		tenant_id TEXT NOT NULL,
		status TEXT NOT NULL,
		capabilities TEXT,
		created_at DATETIME,
		pack_cid TEXT
	);
	CREATE TABLE IF NOT EXISTS events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id TEXT NOT NULL,
		type TEXT NOT NULL,
		payload BLOB,
		created_at DATETIME
	);
	CREATE TABLE IF NOT EXISTS audits (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		tenant_id TEXT NOT NULL,
		run_id TEXT NOT NULL,
		type TEXT NOT NULL,
		payload BLOB,
		created_at DATETIME
	);
	CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
	CREATE INDEX IF NOT EXISTS idx_audits_run_id ON audits(run_id);
	`
	_, err := s.db.Exec(query)
	return err
}

// CreateRun inserts a new run record.
func (s *SQLiteStore) CreateRun(ctx context.Context, r RunRecord) error {
	caps, _ := json.Marshal(r.Capabilities)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO runs (id, tenant_id, status, capabilities, created_at, pack_cid)
		VALUES (?, ?, ?, ?, ?, ?)`,
		r.ID, r.TenantID, r.Status, string(caps), r.CreatedAt, r.PackCID)
	return err
}

// GetRun retrieves a run by ID and Tenant.
func (s *SQLiteStore) GetRun(ctx context.Context, tenantID, id string) (RunRecord, error) {
	var r RunRecord
	var caps string
	row := s.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, status, capabilities, created_at, pack_cid
		FROM runs WHERE id = ? AND tenant_id = ?`, id, tenantID)
	err := row.Scan(&r.ID, &r.TenantID, &r.Status, &caps, &r.CreatedAt, &r.PackCID)
	if err != nil {
		return r, err
	}
	_ = json.Unmarshal([]byte(caps), &r.Capabilities)
	return r, nil
}

// AppendEvent adds an event to the stream.
func (s *SQLiteStore) AppendEvent(ctx context.Context, e EventRecord) (int64, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO events (run_id, type, payload, created_at)
		VALUES (?, ?, ?, ?)`,
		e.RunID, e.Type, e.Payload, e.CreatedAt)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// ListEvents retrieves events for a run, optionally starting after a specific sequence ID.
func (s *SQLiteStore) ListEvents(ctx context.Context, tenantID, runID string, afterID int64) ([]EventRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT type, payload, created_at FROM events
		WHERE run_id = ? AND id > ? ORDER BY id ASC`, runID, afterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []EventRecord
	for rows.Next() {
		var e EventRecord
		e.RunID = runID
		if err := rows.Scan(&e.Type, &e.Payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

// AppendAudit adds an audit log entry.
func (s *SQLiteStore) AppendAudit(ctx context.Context, a AuditRecord) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audits (tenant_id, run_id, type, payload, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		a.TenantID, a.RunID, a.Type, a.Payload, a.CreatedAt)
	return err
}

// ListAudit retrieves audit logs for a specific run.
func (s *SQLiteStore) ListAudit(ctx context.Context, tenantID, runID string) ([]AuditRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT type, payload, created_at FROM audits
		WHERE tenant_id = ? AND run_id = ? ORDER BY id ASC`, tenantID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var audits []AuditRecord
	for rows.Next() {
		var a AuditRecord
		a.TenantID = tenantID
		a.RunID = runID
		if err := rows.Scan(&a.Type, &a.Payload, &a.CreatedAt); err != nil {
			return nil, err
		}
		audits = append(audits, a)
	}
	return audits, nil
}
