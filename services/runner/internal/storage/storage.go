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
