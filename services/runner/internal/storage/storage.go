package storage

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

//go:embed migrations/*.sql
var migrationFS embed.FS

type RunRecord struct {
	ID, TenantID, Status string
	Capabilities         []string
	CreatedAt            time.Time
}
type EventRecord struct {
	ID          int64
	RunID, Type string
	Payload     []byte
	CreatedAt   time.Time
}
type AuditRecord struct {
	ID                    int64
	TenantID, RunID, Type string
	Payload               []byte
	CreatedAt             time.Time
}
type SessionRecord struct {
	ID, TenantID, UserID string
	CreatedAt, ExpiresAt time.Time
}

type RunsStore interface {
	CreateRun(context.Context, RunRecord) error
	GetRun(context.Context, string, string) (RunRecord, error)
}
type EventsStore interface {
	AppendEvent(context.Context, EventRecord) (int64, error)
	ListEvents(context.Context, string, string, int64) ([]EventRecord, error)
}
type AuditStore interface {
	AppendAudit(context.Context, AuditRecord) error
	ListAudit(context.Context, string, string) ([]AuditRecord, error)
}
type GatesStore interface{}
type CapsuleStore interface{}
type PluginsStore interface{}

type JobRecord struct {
	ID, TenantID, SessionID, RunID, AgentID, NodeID string
	Type, PayloadJSON, IdempotencyKey               string
	Priority, Attempts, MaxAttempts                 int
	Status, LeaseToken, LastError                   string
	NextRunAt, LeasedUntil, CreatedAt, UpdatedAt    time.Time
}

type JobAttemptRecord struct {
	ID        int64
	JobID     string
	Attempt   int
	Status    string
	Error     string
	CreatedAt time.Time
}

type NodeRecord struct {
	ID, TenantID, Type, CapabilitiesJSON, Status, TagsJSON string
	LastHeartbeatAt                                        time.Time
	LatencyMS, LoadScore                                   int
	CreatedAt, UpdatedAt                                   time.Time
}
type SessionsStore interface {
	PutSession(context.Context, SessionRecord) error
	GetSession(context.Context, string) (SessionRecord, error)
	DeleteSession(context.Context, string) error
}

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		db.Close()
		return nil, err
	}
	s := &SQLiteStore{db: db}
	return s, s.Migrate(context.Background())
}

func (s *SQLiteStore) Close() error { return s.db.Close() }

func (s *SQLiteStore) exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, query, args...)
}
func (s *SQLiteStore) query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, query, args...)
}
func (s *SQLiteStore) queryRow(ctx context.Context, query string, args ...any) *sql.Row {
	return s.db.QueryRowContext(ctx, query, args...)
}
func esc(v string) string { return strings.ReplaceAll(v, "'", "''") }

func (s *SQLiteStore) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY);`); err != nil {
		return err
	}
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, e := range entries {
		v := e.Name()
		var exists string
		err := s.db.QueryRowContext(ctx, "SELECT version FROM schema_migrations WHERE version = ?", v).Scan(&exists)
		if err == nil {
			continue
		} else if err != sql.ErrNoRows {
			return err
		}
		body, err := migrationFS.ReadFile("migrations/" + v)
		if err != nil {
			return err
		}
		if _, err := s.db.ExecContext(ctx, string(body)); err != nil {
			return err
		}
		if _, err := s.db.ExecContext(ctx, "INSERT INTO schema_migrations(version) VALUES(?)", v); err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteStore) CreateRun(ctx context.Context, rec RunRecord) error {
	caps, _ := json.Marshal(rec.Capabilities)
	_, err := s.db.ExecContext(ctx, "INSERT INTO runs(id,tenant_id,capabilities,created_at,status) VALUES(?,?,?,?,?)", rec.ID, rec.TenantID, string(caps), rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.Status)
	return err
}

func (s *SQLiteStore) GetRun(ctx context.Context, tenantID, runID string) (RunRecord, error) {
	var r RunRecord
	var caps string
	var created string
	err := s.db.QueryRowContext(ctx, "SELECT id,tenant_id,capabilities,created_at,status FROM runs WHERE id=? AND tenant_id=?", runID, tenantID).Scan(&r.ID, &r.TenantID, &caps, &created, &r.Status)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	_ = json.Unmarshal([]byte(caps), &r.Capabilities)
	return r, nil
}

func (s *SQLiteStore) AppendEvent(ctx context.Context, e EventRecord) (int64, error) {
	res, err := s.db.ExecContext(ctx, "INSERT INTO events(run_id,type,payload,created_at) VALUES(?,?,?,?)", e.RunID, e.Type, e.Payload, e.CreatedAt.UTC().Format(time.RFC3339Nano))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *SQLiteStore) ListEvents(ctx context.Context, tenantID, runID string, after int64) ([]EventRecord, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT e.id,e.run_id,e.type,e.payload,e.created_at FROM events e JOIN runs r ON r.id=e.run_id WHERE r.tenant_id=? AND e.run_id=? AND e.id>? ORDER BY e.id ASC", tenantID, runID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []EventRecord
	for rows.Next() {
		var r EventRecord
		var created string
		if err := rows.Scan(&r.ID, &r.RunID, &r.Type, &r.Payload, &created); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) AppendAudit(ctx context.Context, a AuditRecord) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO audit(tenant_id,run_id,type,payload,created_at) VALUES(?,?,?,?,?)", a.TenantID, a.RunID, a.Type, a.Payload, a.CreatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLiteStore) ListAudit(ctx context.Context, tenantID, runID string) ([]AuditRecord, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id,tenant_id,run_id,type,payload,created_at FROM audit WHERE tenant_id=? AND run_id=? ORDER BY id ASC", tenantID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []AuditRecord
	for rows.Next() {
		var r AuditRecord
		var created string
		if err := rows.Scan(&r.ID, &r.TenantID, &r.RunID, &r.Type, &r.Payload, &created); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) EnqueueJob(ctx context.Context, rec JobRecord) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO jobs(id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rec.ID, rec.TenantID, rec.SessionID, rec.RunID, rec.AgentID, rec.NodeID, rec.Type, rec.PayloadJSON, rec.IdempotencyKey, rec.Priority, rec.Status, rec.Attempts, rec.MaxAttempts, rec.NextRunAt.UTC().Format(time.RFC3339Nano), rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLiteStore) GetJobByIdempotency(ctx context.Context, tenantID, key string) (JobRecord, error) {
	var r JobRecord
	var nextRun, created, updated string
	var leasedUntilNull, leaseTokenNull, lastErrorNull sql.NullString
	err := s.db.QueryRowContext(ctx, "SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,leased_until,lease_token,last_error,created_at,updated_at FROM jobs WHERE tenant_id=? AND idempotency_key=?", tenantID, key).Scan(&r.ID, &r.TenantID, &r.SessionID, &r.RunID, &r.AgentID, &r.NodeID, &r.Type, &r.PayloadJSON, &r.IdempotencyKey, &r.Priority, &r.Status, &r.Attempts, &r.MaxAttempts, &nextRun, &leasedUntilNull, &leaseTokenNull, &lastErrorNull, &created, &updated)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.NextRunAt, _ = time.Parse(time.RFC3339Nano, nextRun)
	if leasedUntilNull.Valid && leasedUntilNull.String != "" {
		r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, leasedUntilNull.String)
	}
	r.LeaseToken = leaseTokenNull.String
	r.LastError = lastErrorNull.String
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
	return r, nil
}

func (s *SQLiteStore) LeaseReadyJobs(ctx context.Context, now time.Time, limit int, leaseToken string, leaseFor time.Duration) ([]JobRecord, error) {
	if limit <= 0 {
		limit = 1
	}
	leaseUntil := now.Add(leaseFor).UTC().Format(time.RFC3339Nano)
	nowStr := now.UTC().Format(time.RFC3339Nano)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Select IDs first
	rows, err := tx.QueryContext(ctx, fmt.Sprintf("SELECT id FROM jobs WHERE status IN ('queued','retry_wait') AND next_run_at<=? AND (leased_until IS NULL OR leased_until<?) ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC LIMIT %d", limit), nowStr, nowStr)
	if err != nil {
		return nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()

	if len(ids) == 0 {
		return []JobRecord{}, nil
	}

	// Update selected jobs
	query := fmt.Sprintf("UPDATE jobs SET status='leased', lease_token=?, leased_until=?, updated_at=? WHERE id IN ('%s')", strings.Join(ids, "','"))
	if _, err := tx.ExecContext(ctx, query, leaseToken, leaseUntil, nowStr); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Fetch updated jobs
	return s.getJobsByLease(ctx, leaseToken)
}

func (s *SQLiteStore) getJobsByLease(ctx context.Context, leaseToken string) ([]JobRecord, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,leased_until,lease_token,last_error,created_at,updated_at FROM jobs WHERE lease_token=? ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC", leaseToken)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []JobRecord
	for rows.Next() {
		var r JobRecord
		var nextRun, created, updated string
		var leasedUntilNull, leaseTokenNull, lastErrorNull sql.NullString
		if err := rows.Scan(&r.ID, &r.TenantID, &r.SessionID, &r.RunID, &r.AgentID, &r.NodeID, &r.Type, &r.PayloadJSON, &r.IdempotencyKey, &r.Priority, &r.Status, &r.Attempts, &r.MaxAttempts, &nextRun, &leasedUntilNull, &leaseTokenNull, &lastErrorNull, &created, &updated); err != nil {
			return nil, err
		}
		r.NextRunAt, _ = time.Parse(time.RFC3339Nano, nextRun)
		if leasedUntilNull.Valid && leasedUntilNull.String != "" {
			r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, leasedUntilNull.String)
		}
		r.LeaseToken = leaseTokenNull.String
		r.LastError = lastErrorNull.String
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) CompleteJob(ctx context.Context, jobID, leaseToken, resultJSON string, finishedAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	nowStr := finishedAt.UTC().Format(time.RFC3339Nano)
	if _, err := tx.ExecContext(ctx, "UPDATE jobs SET status='completed', lease_token='', leased_until=NULL, updated_at=? WHERE id=? AND lease_token=?", nowStr, jobID, leaseToken); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT OR REPLACE INTO job_results(job_id,result_json,created_at) VALUES(?,?,?)", jobID, resultJSON, nowStr); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO job_attempts(job_id,attempt,status,created_at) SELECT id,attempts,'completed',? FROM jobs WHERE id=?", nowStr, jobID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) FailJob(ctx context.Context, jobID, leaseToken, errMsg string, retryAt time.Time, dead bool) error {
	status := "retry_wait"
	if dead {
		status = "dead_letter"
	}
	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	retryStr := retryAt.UTC().Format(time.RFC3339Nano)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "UPDATE jobs SET attempts=attempts+1,status=?,next_run_at=?,lease_token='',leased_until=NULL,last_error=?,updated_at=? WHERE id=? AND lease_token=?", status, retryStr, errMsg, nowStr, jobID, leaseToken); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO job_attempts(job_id,attempt,status,error,created_at) SELECT id,attempts,?,?,? FROM jobs WHERE id=?", status, errMsg, nowStr, jobID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) UpsertNode(ctx context.Context, rec NodeRecord) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO nodes(id,tenant_id,type,capabilities,status,last_heartbeat_at,latency_ms,load_score,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id,type=excluded.type,capabilities=excluded.capabilities,status=excluded.status,last_heartbeat_at=excluded.last_heartbeat_at,latency_ms=excluded.latency_ms,load_score=excluded.load_score,tags=excluded.tags,updated_at=excluded.updated_at", rec.ID, rec.TenantID, rec.Type, rec.CapabilitiesJSON, rec.Status, rec.LastHeartbeatAt.UTC().Format(time.RFC3339Nano), rec.LatencyMS, rec.LoadScore, rec.TagsJSON, rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLiteStore) ListNodes(ctx context.Context, tenantID string) ([]NodeRecord, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id,tenant_id,type,capabilities,status,last_heartbeat_at,latency_ms,load_score,tags,created_at,updated_at FROM nodes WHERE tenant_id=? ORDER BY id ASC", tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []NodeRecord
	for rows.Next() {
		var r NodeRecord
		var created, updated string
		var hbNull sql.NullString
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Type, &r.CapabilitiesJSON, &r.Status, &hbNull, &r.LatencyMS, &r.LoadScore, &r.TagsJSON, &created, &updated); err != nil {
			return nil, err
		}
		if hbNull.Valid && hbNull.String != "" {
			r.LastHeartbeatAt, _ = time.Parse(time.RFC3339Nano, hbNull.String)
		}
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) PutSession(ctx context.Context, rec SessionRecord) error {
	_, err := s.db.ExecContext(ctx, "INSERT OR REPLACE INTO sessions(id,tenant_id,user_id,created_at,expires_at) VALUES(?,?,?,?,?)", rec.ID, rec.TenantID, rec.UserID, rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.ExpiresAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLiteStore) GetSession(ctx context.Context, id string) (SessionRecord, error) {
	var r SessionRecord
	var created, expires string
	err := s.db.QueryRowContext(ctx, "SELECT id,tenant_id,user_id,created_at,expires_at FROM sessions WHERE id=?", id).Scan(&r.ID, &r.TenantID, &r.UserID, &created, &expires)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	r.ExpiresAt, _ = time.Parse(time.RFC3339Nano, expires)
	return r, nil
}

func (s *SQLiteStore) DeleteSession(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE id=?", id)
	return err
}
