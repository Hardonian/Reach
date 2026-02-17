package storage

import (
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
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

type SQLiteStore struct{ path string }

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	s := &SQLiteStore{path: path}
	return s, s.Migrate(context.Background())
}
func (s *SQLiteStore) Close() error { return nil }

func (s *SQLiteStore) exec(ctx context.Context, sql string) (string, error) {
	cmd := exec.CommandContext(ctx, "sqlite3", "-noheader", "-separator", "|", s.path, sql)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("sqlite3: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}
func esc(v string) string { return strings.ReplaceAll(v, "'", "''") }

func (s *SQLiteStore) Migrate(ctx context.Context) error {
	if _, err := s.exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY);`); err != nil {
		return err
	}
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, e := range entries {
		v := e.Name()
		out, err := s.exec(ctx, fmt.Sprintf(`SELECT version FROM schema_migrations WHERE version='%s';`, esc(v)))
		if err != nil {
			return err
		}
		if out != "" {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + v)
		if err != nil {
			return err
		}
		if _, err := s.exec(ctx, string(body)); err != nil {
			return err
		}
		if _, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO schema_migrations(version) VALUES('%s');`, esc(v))); err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteStore) CreateRun(ctx context.Context, rec RunRecord) error {
	caps, _ := json.Marshal(rec.Capabilities)
	_, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO runs(id,tenant_id,capabilities,created_at,status) VALUES('%s','%s','%s','%s','%s');`, esc(rec.ID), esc(rec.TenantID), esc(string(caps)), rec.CreatedAt.UTC().Format(time.RFC3339Nano), esc(rec.Status)))
	return err
}
func (s *SQLiteStore) GetRun(ctx context.Context, tenantID, runID string) (RunRecord, error) {
	var r RunRecord
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,capabilities,created_at,status FROM runs WHERE id='%s' AND tenant_id='%s';`, esc(runID), esc(tenantID)))
	if err != nil {
		return r, err
	}
	if out == "" {
		return r, ErrNotFound
	}
	parts := strings.Split(out, "|")
	if len(parts) < 5 {
		return r, errors.New("invalid row")
	}
	r.ID, r.TenantID, r.Status = parts[0], parts[1], parts[4]
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, parts[3])
	_ = json.Unmarshal([]byte(parts[2]), &r.Capabilities)
	return r, nil
}
func (s *SQLiteStore) AppendEvent(ctx context.Context, e EventRecord) (int64, error) {
	payload := base64.StdEncoding.EncodeToString(e.Payload)
	out, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO events(run_id,type,payload,created_at) VALUES('%s','%s','%s','%s'); SELECT last_insert_rowid();`, esc(e.RunID), esc(e.Type), payload, e.CreatedAt.UTC().Format(time.RFC3339Nano)))
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(strings.TrimSpace(strings.Split(out, "\n")[len(strings.Split(out, "\n"))-1]), 10, 64)
}
func (s *SQLiteStore) ListEvents(ctx context.Context, tenantID, runID string, after int64) ([]EventRecord, error) {
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT e.id,e.run_id,e.type,e.payload,e.created_at FROM events e JOIN runs r ON r.id=e.run_id WHERE r.tenant_id='%s' AND e.run_id='%s' AND e.id>%d ORDER BY e.id ASC;`, esc(tenantID), esc(runID), after))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []EventRecord{}, nil
	}
	lines := strings.Split(out, "\n")
	res := make([]EventRecord, 0, len(lines))
	for _, ln := range lines {
		p := strings.Split(ln, "|")
		if len(p) < 5 {
			continue
		}
		id, _ := strconv.ParseInt(p[0], 10, 64)
		payload, _ := base64.StdEncoding.DecodeString(p[3])
		at, _ := time.Parse(time.RFC3339Nano, p[4])
		res = append(res, EventRecord{ID: id, RunID: p[1], Type: p[2], Payload: payload, CreatedAt: at})
	}
	return res, nil
}
func (s *SQLiteStore) AppendAudit(ctx context.Context, a AuditRecord) error {
	payload := base64.StdEncoding.EncodeToString(a.Payload)
	_, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO audit(tenant_id,run_id,type,payload,created_at) VALUES('%s','%s','%s','%s','%s');`, esc(a.TenantID), esc(a.RunID), esc(a.Type), payload, a.CreatedAt.UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *SQLiteStore) ListAudit(ctx context.Context, tenantID, runID string) ([]AuditRecord, error) {
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,run_id,type,payload,created_at FROM audit WHERE tenant_id='%s' AND run_id='%s' ORDER BY id ASC;`, esc(tenantID), esc(runID)))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []AuditRecord{}, nil
	}
	lines := strings.Split(out, "\n")
	res := make([]AuditRecord, 0, len(lines))
	for _, ln := range lines {
		p := strings.Split(ln, "|")
		if len(p) < 6 {
			continue
		}
		id, _ := strconv.ParseInt(p[0], 10, 64)
		payload, _ := base64.StdEncoding.DecodeString(p[4])
		at, _ := time.Parse(time.RFC3339Nano, p[5])
		res = append(res, AuditRecord{ID: id, TenantID: p[1], RunID: p[2], Type: p[3], Payload: payload, CreatedAt: at})
	}
	return res, nil
}

func (s *SQLiteStore) EnqueueJob(ctx context.Context, rec JobRecord) error {
	_, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO jobs(id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,created_at,updated_at) VALUES('%s','%s','%s','%s','%s','%s','%s','%s','%s',%d,'%s',%d,%d,'%s','%s','%s');`, esc(rec.ID), esc(rec.TenantID), esc(rec.SessionID), esc(rec.RunID), esc(rec.AgentID), esc(rec.NodeID), esc(rec.Type), esc(rec.PayloadJSON), esc(rec.IdempotencyKey), rec.Priority, esc(rec.Status), rec.Attempts, rec.MaxAttempts, rec.NextRunAt.UTC().Format(time.RFC3339Nano), rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.UpdatedAt.UTC().Format(time.RFC3339Nano)))
	return err
}

func (s *SQLiteStore) GetJobByIdempotency(ctx context.Context, tenantID, key string) (JobRecord, error) {
	var r JobRecord
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,IFNULL(leased_until,''),IFNULL(lease_token,''),IFNULL(last_error,''),created_at,updated_at FROM jobs WHERE tenant_id='%s' AND idempotency_key='%s';`, esc(tenantID), esc(key)))
	if err != nil {
		return r, err
	}
	if out == "" {
		return r, ErrNotFound
	}
	parts := strings.Split(out, "|")
	if len(parts) < 19 {
		return r, errors.New("invalid job row")
	}
	r.ID, r.TenantID, r.SessionID, r.RunID, r.AgentID, r.NodeID = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
	r.Type, r.PayloadJSON, r.IdempotencyKey = parts[6], parts[7], parts[8]
	r.Priority, _ = strconv.Atoi(parts[9])
	r.Status = parts[10]
	r.Attempts, _ = strconv.Atoi(parts[11])
	r.MaxAttempts, _ = strconv.Atoi(parts[12])
	r.NextRunAt, _ = time.Parse(time.RFC3339Nano, parts[13])
	if parts[14] != "" {
		r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, parts[14])
	}
	r.LeaseToken, r.LastError = parts[15], parts[16]
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, parts[17])
	r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, parts[18])
	return r, nil
}

func (s *SQLiteStore) LeaseReadyJobs(ctx context.Context, now time.Time, limit int, leaseToken string, leaseFor time.Duration) ([]JobRecord, error) {
	if limit <= 0 {
		limit = 1
	}
	leaseUntil := now.Add(leaseFor).UTC().Format(time.RFC3339Nano)
	nowStr := now.UTC().Format(time.RFC3339Nano)
	_, err := s.exec(ctx, fmt.Sprintf(`WITH picked AS (SELECT id FROM jobs WHERE status IN ('queued','retry_wait') AND next_run_at<='%s' AND (leased_until IS NULL OR leased_until<'%s') ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC LIMIT %d) UPDATE jobs SET status='leased', lease_token='%s', leased_until='%s', updated_at='%s' WHERE id IN (SELECT id FROM picked);`, nowStr, nowStr, limit, esc(leaseToken), leaseUntil, nowStr))
	if err != nil {
		return nil, err
	}
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,session_id,run_id,agent_id,node_id,type,payload_json,idempotency_key,priority,status,attempts,max_attempts,next_run_at,IFNULL(leased_until,''),IFNULL(lease_token,''),IFNULL(last_error,''),created_at,updated_at FROM jobs WHERE lease_token='%s' ORDER BY priority ASC, tenant_id ASC, session_id ASC, created_at ASC, id ASC;`, esc(leaseToken)))
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(out) == "" {
		return []JobRecord{}, nil
	}
	res := []JobRecord{}
	for _, ln := range strings.Split(out, "\n") {
		parts := strings.Split(ln, "|")
		if len(parts) < 19 {
			continue
		}
		var r JobRecord
		r.ID, r.TenantID, r.SessionID, r.RunID, r.AgentID, r.NodeID = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
		r.Type, r.PayloadJSON, r.IdempotencyKey = parts[6], parts[7], parts[8]
		r.Priority, _ = strconv.Atoi(parts[9])
		r.Status = parts[10]
		r.Attempts, _ = strconv.Atoi(parts[11])
		r.MaxAttempts, _ = strconv.Atoi(parts[12])
		r.NextRunAt, _ = time.Parse(time.RFC3339Nano, parts[13])
		if parts[14] != "" {
			r.LeasedUntil, _ = time.Parse(time.RFC3339Nano, parts[14])
		}
		r.LeaseToken, r.LastError = parts[15], parts[16]
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, parts[17])
		r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, parts[18])
		res = append(res, r)
	}
	return res, nil
}

func (s *SQLiteStore) CompleteJob(ctx context.Context, jobID, leaseToken, resultJSON string, finishedAt time.Time) error {
	_, err := s.exec(ctx, fmt.Sprintf(`UPDATE jobs SET status='completed', lease_token='', leased_until=NULL, updated_at='%s' WHERE id='%s' AND lease_token='%s'; INSERT OR REPLACE INTO job_results(job_id,result_json,created_at) VALUES('%s','%s','%s'); INSERT INTO job_attempts(job_id,attempt,status,created_at) SELECT id,attempts,'completed','%s' FROM jobs WHERE id='%s';`, finishedAt.UTC().Format(time.RFC3339Nano), esc(jobID), esc(leaseToken), esc(jobID), esc(resultJSON), finishedAt.UTC().Format(time.RFC3339Nano), finishedAt.UTC().Format(time.RFC3339Nano), esc(jobID)))
	return err
}

func (s *SQLiteStore) FailJob(ctx context.Context, jobID, leaseToken, errMsg string, retryAt time.Time, dead bool) error {
	status := "retry_wait"
	if dead {
		status = "dead_letter"
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := s.exec(ctx, fmt.Sprintf(`UPDATE jobs SET attempts=attempts+1,status='%s',next_run_at='%s',lease_token='',leased_until=NULL,last_error='%s',updated_at='%s' WHERE id='%s' AND lease_token='%s'; INSERT INTO job_attempts(job_id,attempt,status,error,created_at) SELECT id,attempts,'%s','%s','%s' FROM jobs WHERE id='%s';`, status, retryAt.UTC().Format(time.RFC3339Nano), esc(errMsg), now, esc(jobID), esc(leaseToken), status, esc(errMsg), now, esc(jobID)))
	return err
}

func (s *SQLiteStore) UpsertNode(ctx context.Context, rec NodeRecord) error {
	_, err := s.exec(ctx, fmt.Sprintf(`INSERT INTO nodes(id,tenant_id,type,capabilities,status,last_heartbeat_at,latency_ms,load_score,tags,created_at,updated_at) VALUES('%s','%s','%s','%s','%s','%s',%d,%d,'%s','%s','%s') ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id,type=excluded.type,capabilities=excluded.capabilities,status=excluded.status,last_heartbeat_at=excluded.last_heartbeat_at,latency_ms=excluded.latency_ms,load_score=excluded.load_score,tags=excluded.tags,updated_at=excluded.updated_at;`, esc(rec.ID), esc(rec.TenantID), esc(rec.Type), esc(rec.CapabilitiesJSON), esc(rec.Status), rec.LastHeartbeatAt.UTC().Format(time.RFC3339Nano), rec.LatencyMS, rec.LoadScore, esc(rec.TagsJSON), rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.UpdatedAt.UTC().Format(time.RFC3339Nano)))
	return err
}

func (s *SQLiteStore) ListNodes(ctx context.Context, tenantID string) ([]NodeRecord, error) {
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,type,capabilities,status,IFNULL(last_heartbeat_at,''),latency_ms,load_score,tags,created_at,updated_at FROM nodes WHERE tenant_id='%s' ORDER BY id ASC;`, esc(tenantID)))
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(out) == "" {
		return []NodeRecord{}, nil
	}
	res := []NodeRecord{}
	for _, ln := range strings.Split(out, "\n") {
		p := strings.Split(ln, "|")
		if len(p) < 11 {
			continue
		}
		var r NodeRecord
		r.ID, r.TenantID, r.Type, r.CapabilitiesJSON, r.Status = p[0], p[1], p[2], p[3], p[4]
		if p[5] != "" {
			r.LastHeartbeatAt, _ = time.Parse(time.RFC3339Nano, p[5])
		}
		r.LatencyMS, _ = strconv.Atoi(p[6])
		r.LoadScore, _ = strconv.Atoi(p[7])
		r.TagsJSON = p[8]
		r.CreatedAt, _ = time.Parse(time.RFC3339Nano, p[9])
		r.UpdatedAt, _ = time.Parse(time.RFC3339Nano, p[10])
		res = append(res, r)
	}
	return res, nil
}

func (s *SQLiteStore) PutSession(ctx context.Context, rec SessionRecord) error {
	_, err := s.exec(ctx, fmt.Sprintf(`INSERT OR REPLACE INTO sessions(id,tenant_id,user_id,created_at,expires_at) VALUES('%s','%s','%s','%s','%s');`, esc(rec.ID), esc(rec.TenantID), esc(rec.UserID), rec.CreatedAt.UTC().Format(time.RFC3339Nano), rec.ExpiresAt.UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *SQLiteStore) GetSession(ctx context.Context, id string) (SessionRecord, error) {
	var r SessionRecord
	out, err := s.exec(ctx, fmt.Sprintf(`SELECT id,tenant_id,user_id,created_at,expires_at FROM sessions WHERE id='%s';`, esc(id)))
	if err != nil {
		return r, err
	}
	if out == "" {
		return r, ErrNotFound
	}
	p := strings.Split(out, "|")
	if len(p) < 5 {
		return r, errors.New("invalid session")
	}
	r.ID, r.TenantID, r.UserID = p[0], p[1], p[2]
	r.CreatedAt, _ = time.Parse(time.RFC3339Nano, p[3])
	r.ExpiresAt, _ = time.Parse(time.RFC3339Nano, p[4])
	return r, nil
}
func (s *SQLiteStore) DeleteSession(ctx context.Context, id string) error {
	_, err := s.exec(ctx, fmt.Sprintf(`DELETE FROM sessions WHERE id='%s';`, esc(id)))
	return err
}
