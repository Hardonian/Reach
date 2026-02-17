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
	"strings"
	"time"

	"reach/services/integration-hub/internal/core"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type Store struct{ path string }

func Open(path string) (*Store, error) {
	if path == ":memory:" {
		path = filepath.Join(os.TempDir(), fmt.Sprintf("reach-integration-%d.sqlite", time.Now().UnixNano()))
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	s := &Store{path: path}
	return s, s.migrate(context.Background())
}

func (s *Store) exec(ctx context.Context, sql string) (string, error) {
	cmd := exec.CommandContext(ctx, "sqlite3", "-noheader", "-separator", "|", s.path, sql)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("sqlite3: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

func (s *Store) migrate(ctx context.Context) error {
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

func esc(v string) string { return strings.ReplaceAll(v, "'", "''") }

func (s *Store) SaveOAuthState(state, tenantID, provider string) error {
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO oauth_states(state, tenant_id, provider, created_at) VALUES ('%s','%s','%s','%s');`, esc(state), esc(tenantID), esc(provider), time.Now().UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *Store) ConsumeOAuthState(state, tenantID, provider string) error {
	out, err := s.exec(context.Background(), fmt.Sprintf(`DELETE FROM oauth_states WHERE state='%s' AND tenant_id='%s' AND provider='%s'; SELECT changes();`, esc(state), esc(tenantID), esc(provider)))
	if err != nil {
		return err
	}
	if !strings.HasSuffix(out, "1") {
		return errors.New("invalid oauth state")
	}
	return nil
}
func (s *Store) SaveToken(tenantID, provider, accessToken, refreshToken, expiresAt string, scopes []string) error {
	scopeJSON, _ := json.Marshal(scopes)
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO oauth_tokens(tenant_id, provider, access_token, refresh_token, expires_at, scopes, created_at) VALUES('%s','%s','%s','%s','%s','%s','%s') ON CONFLICT(tenant_id, provider) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, scopes=excluded.scopes;`, esc(tenantID), esc(provider), esc(accessToken), esc(refreshToken), esc(expiresAt), esc(string(scopeJSON)), time.Now().UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *Store) ListIntegrations(tenantID string) ([]map[string]any, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT provider,expires_at,scopes FROM oauth_tokens WHERE tenant_id='%s';`, esc(tenantID)))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []map[string]any{}, nil
	}
	var res []map[string]any
	for _, ln := range strings.Split(out, "\n") {
		p := strings.Split(ln, "|")
		if len(p) < 3 {
			continue
		}
		var scopes []string
		_ = json.Unmarshal([]byte(p[2]), &scopes)
		res = append(res, map[string]any{"provider": p[0], "expiresAt": p[1], "scopes": scopes})
	}
	return res, nil
}
func (s *Store) SaveWebhookSecret(tenantID, provider, secret string) error {
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO webhook_secrets(tenant_id, provider, secret) VALUES('%s','%s','%s') ON CONFLICT(tenant_id,provider) DO UPDATE SET secret=excluded.secret;`, esc(tenantID), esc(provider), esc(secret)))
	return err
}
func (s *Store) WebhookSecret(tenantID, provider string) (string, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT secret FROM webhook_secrets WHERE tenant_id='%s' AND provider='%s';`, esc(tenantID), esc(provider)))
	if err != nil || out == "" {
		return "", errors.New("not found")
	}
	return out, nil
}
func (s *Store) SaveEvent(e core.NormalizedEvent) error {
	payload, _ := json.Marshal(e)
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO events(event_id,tenant_id,provider,trigger_type,payload,created_at) VALUES('%s','%s','%s','%s','%s','%s');`, esc(e.EventID), esc(e.TenantID), esc(e.Provider), esc(e.TriggerType), esc(base64.StdEncoding.EncodeToString(payload)), time.Now().UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *Store) ListEvents(tenantID string) ([]json.RawMessage, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT payload FROM events WHERE tenant_id='%s' ORDER BY created_at DESC LIMIT 100;`, esc(tenantID)))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []json.RawMessage{}, nil
	}
	var res []json.RawMessage
	for _, ln := range strings.Split(out, "\n") {
		raw, _ := base64.StdEncoding.DecodeString(ln)
		res = append(res, raw)
	}
	return res, nil
}
func (s *Store) WriteAudit(tenantID, action string, details map[string]any) error {
	raw, _ := json.Marshal(details)
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO audit_logs(tenant_id,action,details,created_at) VALUES('%s','%s','%s','%s');`, esc(tenantID), esc(action), esc(base64.StdEncoding.EncodeToString(raw)), time.Now().UTC().Format(time.RFC3339Nano)))
	return err
}
func (s *Store) ListAudit(tenantID string) ([]json.RawMessage, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT action,details FROM audit_logs WHERE tenant_id='%s' ORDER BY id DESC LIMIT 100;`, esc(tenantID)))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []json.RawMessage{}, nil
	}
	var res []json.RawMessage
	for _, ln := range strings.Split(out, "\n") {
		p := strings.Split(ln, "|")
		if len(p) < 2 {
			continue
		}
		details, _ := base64.StdEncoding.DecodeString(p[1])
		item := map[string]any{"action": p[0]}
		_ = json.Unmarshal(details, &item)
		raw, _ := json.Marshal(item)
		res = append(res, raw)
	}
	return res, nil
}
func (s *Store) CheckAndMarkReplay(tenantID, provider, nonce string, maxAge time.Duration) error {
	if nonce == "" {
		return errors.New("missing nonce")
	}
	_, _ = s.exec(context.Background(), fmt.Sprintf(`DELETE FROM replay_guard WHERE tenant_id='%s' AND created_at < '%s';`, esc(tenantID), time.Now().Add(-maxAge).UTC().Format(time.RFC3339Nano)))
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO replay_guard(id,tenant_id,created_at) VALUES('%s','%s','%s');`, esc(tenantID+":"+provider+":"+nonce), esc(tenantID), time.Now().UTC().Format(time.RFC3339Nano)))
	if err != nil {
		return errors.New("replay detected")
	}
	return nil
}
func (s *Store) Close() error { return nil }

type ConnectorRecord struct {
	ID           string
	TenantID     string
	Provider     string
	Version      string
	Scopes       []string
	Capabilities []string
	Status       string
}

func (s *Store) UpsertConnector(c ConnectorRecord) error {
	scopes, _ := json.Marshal(c.Scopes)
	caps, _ := json.Marshal(c.Capabilities)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO connectors(id,tenant_id,provider,version,scopes,capabilities,status,created_at,updated_at) VALUES('%s','%s','%s','%s','%s','%s','%s','%s','%s') ON CONFLICT(id,tenant_id) DO UPDATE SET provider=excluded.provider,version=excluded.version,scopes=excluded.scopes,capabilities=excluded.capabilities,status=excluded.status,updated_at=excluded.updated_at;`, esc(c.ID), esc(c.TenantID), esc(c.Provider), esc(c.Version), esc(string(scopes)), esc(string(caps)), esc(c.Status), now, now))
	return err
}

func (s *Store) ListConnectors(tenantID string) ([]ConnectorRecord, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT id,tenant_id,provider,version,scopes,capabilities,status FROM connectors WHERE tenant_id='%s';`, esc(tenantID)))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []ConnectorRecord{}, nil
	}
	rows := strings.Split(out, "\n")
	res := make([]ConnectorRecord, 0, len(rows))
	for _, ln := range rows {
		p := strings.Split(ln, "|")
		if len(p) < 7 {
			continue
		}
		item := ConnectorRecord{ID: p[0], TenantID: p[1], Provider: p[2], Version: p[3], Status: p[6]}
		_ = json.Unmarshal([]byte(p[4]), &item.Scopes)
		_ = json.Unmarshal([]byte(p[5]), &item.Capabilities)
		res = append(res, item)
	}
	return res, nil
}

func (s *Store) SetPolicyProfile(tenantID, profile string) error {
	_, err := s.exec(context.Background(), fmt.Sprintf(`INSERT INTO tenant_policy_profiles(tenant_id,profile,updated_at) VALUES('%s','%s','%s') ON CONFLICT(tenant_id) DO UPDATE SET profile=excluded.profile,updated_at=excluded.updated_at;`, esc(tenantID), esc(profile), time.Now().UTC().Format(time.RFC3339Nano)))
	return err
}

func (s *Store) GetPolicyProfile(tenantID string) (string, error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT profile FROM tenant_policy_profiles WHERE tenant_id='%s';`, esc(tenantID)))
	if err != nil {
		return "", err
	}
	if out == "" {
		return "moderate", nil
	}
	return out, nil
}

func (s *Store) GetToken(tenantID, provider string) (accessToken string, scopes []string, err error) {
	out, err := s.exec(context.Background(), fmt.Sprintf(`SELECT access_token,scopes FROM oauth_tokens WHERE tenant_id='%s' AND provider='%s';`, esc(tenantID), esc(provider)))
	if err != nil {
		return "", nil, err
	}
	if out == "" {
		return "", nil, errors.New("token not found")
	}
	p := strings.Split(out, "|")
	if len(p) < 2 {
		return "", nil, errors.New("token malformed")
	}
	_ = json.Unmarshal([]byte(p[1]), &scopes)
	return p[0], scopes, nil
}
