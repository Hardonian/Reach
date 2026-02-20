package storage

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

//go:embed migrations/*.sql
var migrationFS embed.FS

type RunRecord struct {
	ID, TenantID, Status, PackCID string
	Capabilities                  []string
	CreatedAt                     time.Time
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
	TPMPubKeyJSON, HardwareFingerprint                     string
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
	db  *sql.DB
	mu  sync.RWMutex
	ops preparedOps
}

type preparedOps struct {
	createRun      *sql.Stmt
	getRun         *sql.Stmt
	appendEvent    *sql.Stmt
	listEvents     *sql.Stmt
	appendAudit    *sql.Stmt
	listAudit      *sql.Stmt
	enqueueJob     *sql.Stmt
	getJobByKey    *sql.Stmt
	getJobsByLease *sql.Stmt
	upsertNode     *sql.Stmt
	listNodes      *sql.Stmt
	putSession     *sql.Stmt
	getSession     *sql.Stmt
	deleteSession  *sql.Stmt
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	s := &SQLiteStore{db: db}
	if err := s.Migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	if err := s.prepareStmts(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *SQLiteStore) prepareStmts() error {
	var err error
	s.ops.createRun, err = s.db.Prepare("INSERT INTO runs(id,tenant_id,capabilities,created_at,status,pack_cid) VALUES(?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	s.ops.getRun, err = s.db.Prepare("SELECT id,tenant_id,capabilities,created_at,status,pack_cid FROM runs WHERE id=? AND tenant_id=?")
	if err != nil {
		return err
	}
	s.ops.appendEvent, err = s.db.Prepare("INSERT INTO events(run_id,type,payload,created_at) VALUES(?,?,?,?)")
	if err != nil {
		return err
	}
	s.ops.listEvents, err = s.db.Prepare("SELECT e.id,e.run_id,e.type,e.payload,e.created_at FROM events e JOIN runs r ON r.id=e.run_id WHERE r.tenant_id=? AND e.run_id=? AND e.id>? ORDER BY e.id ASC")
	if err != nil {
		return err
	}
	s.ops.appendAudit, err = s.db.Prepare("INSERT INTO audit(tenant_id,run_id,type,payload,created_at) VALUES(?,?,?,?,?)")
	if err != nil {
		return err
	}
	s.ops.listAudit, err = s.db.Prepare("SELECT id,tenant_id,run_id,type,payload,created_at FROM audit WHERE tenant_id=? AND run_id=? ORDER BY id ASC")
	if err != nil {
		return err
	}
	s.ops.enqueueJob, err = s.db.Prepare("INSERT INTO jobs(id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	s.ops.getJobByKey, err = s.db.Prepare("SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,leased_until,lease_token,last_error,created_at,updated_at FROM jobs WHERE tenant_id=? AND idempotency_key=?")
	if err != nil {
		return err
	}
	s.ops.getJobsByLease, err = s.db.Prepare("SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,leased_until,lease_token,last_error,created_at,updated_at FROM jobs WHERE lease_token=? ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC")
	if err != nil {
		return err
	}
	s.ops.upsertNode, err = s.db.Prepare("INSERT INTO nodes(id,tenant_id,type,capabilities,status,last_heartbeat_at,latency_ms,load_score,tags,tpm_pub_key,hardware_fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id,type=excluded.type,capabilities=excluded.capabilities,status=excluded.status,last_heartbeat_at=excluded.last_heartbeat_at,latency_ms=excluded.latency_ms,load_score=excluded.load_score,tags=excluded.tags,tpm_pub_key=excluded.tpm_pub_key,hardware_fingerprint=excluded.hardware_fingerprint,updated_at=excluded.updated_at")
	if err != nil {
		return err
	}
	s.ops.listNodes, err = s.db.Prepare("SELECT id,tenant_id,type,capabilities,status,last_heartbeat_at,latency_ms,load_score,tags,tpm_pub_key,hardware_fingerprint,created_at,updated_at FROM nodes WHERE tenant_id=? ORDER BY id ASC")
	if err != nil {
		return err
	}
	s.ops.putSession, err = s.db.Prepare("INSERT OR REPLACE INTO sessions(id,tenant_id,user_id,created_at,expires_at) VALUES(?,?,?,?,?)")
	if err != nil {
		return err
	}
	s.ops.getSession, err = s.db.Prepare("SELECT id,tenant_id,user_id,created_at,expires_at FROM sessions WHERE id=?")
	if err != nil {
		return err
	}
	s.ops.deleteSession, err = s.db.Prepare("DELETE FROM sessions WHERE id=?")
	if err != nil {
		return err
	}
	return nil
}

func (s *SQLiteStore) Close() error {
	if s.ops.createRun != nil {
		s.ops.createRun.Close()
	}
	if s.ops.getRun != nil {
		s.ops.getRun.Close()
	}
	if s.ops.appendEvent != nil {
		s.ops.appendEvent.Close()
	}
	if s.ops.listEvents != nil {
		s.ops.listEvents.Close()
	}
	if s.ops.appendAudit != nil {
		s.ops.appendAudit.Close()
	}
	if s.ops.listAudit != nil {
		s.ops.listAudit.Close()
	}
	if s.ops.enqueueJob != nil {
		s.ops.enqueueJob.Close()
	}
	if s.ops.getJobByKey != nil {
		s.ops.getJobByKey.Close()
	}
	if s.ops.getJobsByLease != nil {
		s.ops.getJobsByLease.Close()
	}
	if s.ops.upsertNode != nil {
		s.ops.upsertNode.Close()
	}
	if s.ops.listNodes != nil {
		s.ops.listNodes.Close()
	}
	if s.ops.putSession != nil {
		s.ops.putSession.Close()
	}
	if s.ops.getSession != nil {
		s.ops.getSession.Close()
	}
	if s.ops.deleteSession != nil {
		s.ops.deleteSession.Close()
	}
	return s.db.Close()
}

func (s *SQLiteStore) exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, query, args...)
}
func (s *SQLiteStore) query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, query, args...)
}
func (s *SQLiteStore) queryRow(ctx context.Context, query string, args ...any) *sql.Row {
	return s.db.QueryRowContext(ctx, query, args...)
}

func (s *SQLiteStore) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}
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
	s.mu.RLock()
	defer s.mu.RUnlock()
	caps, _ := json.Marshal(rec.Capabilities)
	_, err := s.ops.createRun.ExecContext(ctx, rec.ID, rec.TenantID, string(caps), rec.CreatedAt.UTC(), rec.Status, rec.PackCID)
	return err
}

func (s *SQLiteStore) GetRun(ctx context.Context, tenantID, runID string) (RunRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var r RunRecord
	var caps string
	var created time.Time
	err := s.ops.getRun.QueryRowContext(ctx, runID, tenantID).Scan(&r.ID, &r.TenantID, &caps, &created, &r.Status, &r.PackCID)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.CreatedAt = created
	_ = json.Unmarshal([]byte(caps), &r.Capabilities)
	return r, nil
}

func (s *SQLiteStore) AppendEvent(ctx context.Context, e EventRecord) (int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	res, err := s.ops.appendEvent.ExecContext(ctx, e.RunID, e.Type, e.Payload, e.CreatedAt.UTC())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *SQLiteStore) ListEvents(ctx context.Context, tenantID, runID string, after int64) ([]EventRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.ops.listEvents.QueryContext(ctx, tenantID, runID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []EventRecord
	for rows.Next() {
		var r EventRecord
		var created time.Time
		if err := rows.Scan(&r.ID, &r.RunID, &r.Type, &r.Payload, &created); err != nil {
			return nil, err
		}
		r.CreatedAt = created
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) AppendAudit(ctx context.Context, a AuditRecord) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, err := s.ops.appendAudit.ExecContext(ctx, a.TenantID, a.RunID, a.Type, a.Payload, a.CreatedAt.UTC())
	return err
}

func (s *SQLiteStore) ListAudit(ctx context.Context, tenantID, runID string) ([]AuditRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.ops.listAudit.QueryContext(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []AuditRecord
	for rows.Next() {
		var r AuditRecord
		var created time.Time
		if err := rows.Scan(&r.ID, &r.TenantID, &r.RunID, &r.Type, &r.Payload, &created); err != nil {
			return nil, err
		}
		r.CreatedAt = created
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) EnqueueJob(ctx context.Context, rec JobRecord) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, err := s.ops.enqueueJob.ExecContext(ctx, rec.ID, rec.TenantID, rec.SessionID, rec.RunID, rec.AgentID, rec.NodeID, rec.Type, rec.PayloadJSON, rec.IdempotencyKey, rec.Priority, rec.Status, rec.Attempts, rec.MaxAttempts, rec.NextRunAt.UTC(), rec.CreatedAt.UTC(), rec.UpdatedAt.UTC())
	return err
}

func (s *SQLiteStore) GetJobByIdempotency(ctx context.Context, tenantID, key string) (JobRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var r JobRecord
	var nextRun, created, updated time.Time
	var leasedUntilNull, leaseTokenNull, lastErrorNull sql.NullString
	err := s.ops.getJobByKey.QueryRowContext(ctx, tenantID, key).Scan(&r.ID, &r.TenantID, &r.SessionID, &r.RunID, &r.AgentID, &r.NodeID, &r.Type, &r.PayloadJSON, &r.IdempotencyKey, &r.Priority, &r.Status, &r.Attempts, &r.MaxAttempts, &nextRun, &leasedUntilNull, &leaseTokenNull, &lastErrorNull, &created, &updated)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.NextRunAt = nextRun
	if leasedUntilNull.Valid && leasedUntilNull.String != "" {
		r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, leasedUntilNull.String)
	}
	r.LeaseToken = leaseTokenNull.String
	r.LastError = lastErrorNull.String
	r.CreatedAt = created
	r.UpdatedAt = updated
	return r, nil
}

func (s *SQLiteStore) LeaseReadyJobs(ctx context.Context, now time.Time, limit int, leaseToken string, leaseFor time.Duration) ([]JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if limit <= 0 {
		limit = 1
	}
	leaseUntil := now.Add(leaseFor).UTC()
	nowTime := now.UTC()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, "SELECT id FROM jobs WHERE status IN ('queued','retry_wait') AND next_run_at<=? AND (leased_until IS NULL OR leased_until<?) ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC LIMIT ?", nowTime, nowTime, limit)
	if err != nil {
		return nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		return []JobRecord{}, nil
	}

	placeholders := strings.Repeat("?,", len(ids)-1) + "?"
	query := "UPDATE jobs SET status='leased', lease_token=?, leased_until=?, updated_at=? WHERE id IN (" + placeholders + ")"
	args := make([]any, 3+len(ids))
	args[0], args[1], args[2] = leaseToken, leaseUntil, nowTime
	for i, id := range ids {
		args[3+i] = id
	}
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	rows, err = s.ops.getJobsByLease.QueryContext(ctx, leaseToken)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []JobRecord
	for rows.Next() {
		var r JobRecord
		var nextRun, created, updated time.Time
		var leasedUntilNull, leaseTokenNull, lastErrorNull sql.NullString
		if err := rows.Scan(&r.ID, &r.TenantID, &r.SessionID, &r.RunID, &r.AgentID, &r.NodeID, &r.Type, &r.PayloadJSON, &r.IdempotencyKey, &r.Priority, &r.Status, &r.Attempts, &r.MaxAttempts, &nextRun, &leasedUntilNull, &leaseTokenNull, &lastErrorNull, &created, &updated); err != nil {
			return nil, err
		}
		r.NextRunAt = nextRun
		if leasedUntilNull.Valid && leasedUntilNull.String != "" {
			r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, leasedUntilNull.String)
		}
		r.LeaseToken = leaseTokenNull.String
		r.LastError = lastErrorNull.String
		r.CreatedAt = created
		r.UpdatedAt = updated
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) CompleteJob(ctx context.Context, jobID, leaseToken, resultJSON string, finishedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	nowTime := finishedAt.UTC()
	if _, err := tx.ExecContext(ctx, "UPDATE jobs SET status='completed', lease_token='', leased_until=NULL, updated_at=? WHERE id=? AND lease_token=?", nowTime, jobID, leaseToken); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT OR REPLACE INTO job_results(job_id,result_json,created_at) VALUES(?,?,?)", jobID, resultJSON, nowTime); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO job_attempts(job_id,attempt,status,created_at) SELECT id,attempts,'completed',? FROM jobs WHERE id=?", nowTime, jobID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) FailJob(ctx context.Context, jobID, leaseToken, errMsg string, retryAt time.Time, dead bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	status := "retry_wait"
	if dead {
		status = "dead_letter"
	}
	nowTime := time.Now().UTC()
	retryTime := retryAt.UTC()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "UPDATE jobs SET attempts=attempts+1,status=?,next_run_at=?,lease_token='',leased_until=NULL,last_error=?,updated_at=? WHERE id=? AND lease_token=?", status, retryTime, errMsg, nowTime, jobID, leaseToken); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO job_attempts(job_id,attempt,status,error,created_at) SELECT id,attempts,?,?,? FROM jobs WHERE id=?", status, errMsg, nowTime, jobID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) UpsertNode(ctx context.Context, rec NodeRecord) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, err := s.ops.upsertNode.ExecContext(ctx, rec.ID, rec.TenantID, rec.Type, rec.CapabilitiesJSON, rec.Status, rec.LastHeartbeatAt.UTC(), rec.LatencyMS, rec.LoadScore, rec.TagsJSON, rec.TPMPubKeyJSON, rec.HardwareFingerprint, rec.CreatedAt.UTC(), rec.UpdatedAt.UTC())
	return err
}

func (s *SQLiteStore) ListNodes(ctx context.Context, tenantID string) ([]NodeRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.ops.listNodes.QueryContext(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []NodeRecord
	for rows.Next() {
		var r NodeRecord
		var created, updated time.Time
		var hbNull sql.NullString
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Type, &r.CapabilitiesJSON, &r.Status, &hbNull, &r.LatencyMS, &r.LoadScore, &r.TagsJSON, &r.TPMPubKeyJSON, &r.HardwareFingerprint, &created, &updated); err != nil {
			return nil, err
		}
		if hbNull.Valid && hbNull.String != "" {
			r.LastHeartbeatAt, _ = time.Parse(time.RFC3339Nano, hbNull.String)
		}
		r.CreatedAt = created
		r.UpdatedAt = updated
		res = append(res, r)
	}
	return res, rows.Err()
}

func (s *SQLiteStore) PutSession(ctx context.Context, rec SessionRecord) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, err := s.ops.putSession.ExecContext(ctx, rec.ID, rec.TenantID, rec.UserID, rec.CreatedAt.UTC(), rec.ExpiresAt.UTC())
	return err
}

func (s *SQLiteStore) GetSession(ctx context.Context, id string) (SessionRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var r SessionRecord
	var created, expires time.Time
	err := s.ops.getSession.QueryRowContext(ctx, id).Scan(&r.ID, &r.TenantID, &r.UserID, &created, &expires)
	if err == sql.ErrNoRows {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	r.CreatedAt = created
	r.ExpiresAt = expires
	return r, nil
}

func (s *SQLiteStore) DeleteSession(ctx context.Context, id string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, err := s.ops.deleteSession.ExecContext(ctx, id)
	return err
}
