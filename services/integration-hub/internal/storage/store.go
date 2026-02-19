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
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"reach/services/integration-hub/internal/core"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type Store struct {
	db *sql.DB
	mu sync.RWMutex
}

func Open(path string) (*Store, error) {
	if path == ":memory:" {
		path = filepath.Join(os.TempDir(), fmt.Sprintf("reach-integration-%d.sqlite", time.Now().UnixNano()))
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", path+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY);`)
	if err != nil {
		return err
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}

	for _, e := range entries {
		v := e.Name()
		var count int
		err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE version=?;`, v).Scan(&count)
		if err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + v)
		if err != nil {
			return err
		}
		if _, err := s.db.ExecContext(ctx, string(body)); err != nil {
			return err
		}
		if _, err := s.db.ExecContext(ctx, `INSERT INTO schema_migrations(version) VALUES(?);`, v); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) SaveOAuthState(state, tenantID, provider string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO oauth_states(state, tenant_id, provider, created_at) VALUES (?,?,?,?);`,
		state, tenantID, provider, time.Now().UTC())
	return err
}

func (s *Store) ConsumeOAuthState(state, tenantID, provider string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	result, err := s.db.ExecContext(context.Background(),
		`DELETE FROM oauth_states WHERE state=? AND tenant_id=? AND provider=?;`,
		state, tenantID, provider)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return errors.New("invalid oauth state")
	}
	return nil
}

func (s *Store) SaveToken(tenantID, provider, accessToken, refreshToken, expiresAt string, scopes []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	scopeJSON, _ := json.Marshal(scopes)
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO oauth_tokens(tenant_id, provider, access_token, refresh_token, expires_at, scopes, created_at) VALUES (?,?,?,?,?,?,?) 
		 ON CONFLICT(tenant_id, provider) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, scopes=excluded.scopes;`,
		tenantID, provider, accessToken, refreshToken, expiresAt, string(scopeJSON), time.Now().UTC())
	return err
}

func (s *Store) ListIntegrations(tenantID string) ([]map[string]any, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.db.QueryContext(context.Background(),
		`SELECT provider,expires_at,scopes FROM oauth_tokens WHERE tenant_id=?;`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []map[string]any
	for rows.Next() {
		var provider, expiresAt, scopesJSON string
		if err := rows.Scan(&provider, &expiresAt, &scopesJSON); err != nil {
			continue
		}
		var scopes []string
		_ = json.Unmarshal([]byte(scopesJSON), &scopes)
		res = append(res, map[string]any{"provider": provider, "expiresAt": expiresAt, "scopes": scopes})
	}
	return res, nil
}

func (s *Store) SaveWebhookSecret(tenantID, provider, secret string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO webhook_secrets(tenant_id, provider, secret) VALUES (?,?,?) 
		 ON CONFLICT(tenant_id,provider) DO UPDATE SET secret=excluded.secret;`,
		tenantID, provider, secret)
	return err
}

func (s *Store) WebhookSecret(tenantID, provider string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var secret string
	err := s.db.QueryRowContext(context.Background(),
		`SELECT secret FROM webhook_secrets WHERE tenant_id=? AND provider=?;`, tenantID, provider).Scan(&secret)
	if err != nil {
		return "", errors.New("not found")
	}
	return secret, nil
}

func (s *Store) SaveEvent(e core.NormalizedEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	payload, _ := json.Marshal(e)
	encoded := make([]byte, len(payload)*2)
	n := len(encoded)
	for i, b := range payload {
		encoded[i*2] = "0123456789abcdef"[b>>4]
		encoded[i*2+1] = "0123456789abcdef"[b&0xf]
	}
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO events(event_id,tenant_id,provider,trigger_type,payload,created_at) VALUES (?,?,?,?,?,?);`,
		e.EventID, e.TenantID, e.Provider, e.TriggerType, encoded[:n], time.Now().UTC())
	return err
}

func (s *Store) ListEvents(tenantID string) ([]json.RawMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.db.QueryContext(context.Background(),
		`SELECT payload FROM events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100;`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []json.RawMessage
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			continue
		}
		// Decode hex back to bytes - skip if not hex encoded
		if len(payload)%2 == 0 && isHex(payload) {
			decoded := make([]byte, len(payload)/2)
			for i := 0; i < len(decoded); i++ {
				hi, lo := payload[i*2], payload[i*2+1]
				decoded[i] = (nibble(hi) << 4) | nibble(lo)
			}
			res = append(res, decoded)
		} else {
			res = append(res, payload)
		}
	}
	return res, nil
}

func isHex(b []byte) bool {
	for _, c := range b {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

func nibble(c byte) byte {
	if c >= '0' && c <= '9' {
		return c - '0'
	}
	return c - 'a' + 10
}

func (s *Store) WriteAudit(tenantID, action string, details map[string]any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, _ := json.Marshal(details)
	encoded := make([]byte, len(raw)*2)
	n := len(encoded)
	for i, b := range raw {
		encoded[i*2] = "0123456789abcdef"[b>>4]
		encoded[i*2+1] = "0123456789abcdef"[b&0xf]
	}
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO audit_logs(tenant_id,action,details,created_at) VALUES (?,?,?,?);`,
		tenantID, action, encoded[:n], time.Now().UTC())
	return err
}

func (s *Store) ListAudit(tenantID string) ([]json.RawMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.db.QueryContext(context.Background(),
		`SELECT action,details FROM audit_logs WHERE tenant_id=? ORDER BY id DESC LIMIT 100;`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []json.RawMessage
	for rows.Next() {
		var action string
		var details []byte
		if err := rows.Scan(&action, &details); err != nil {
			continue
		}
		// Decode hex if needed
		if len(details)%2 == 0 && isHex(details) {
			decoded := make([]byte, len(details)/2)
			for i := 0; i < len(decoded); i++ {
				hi, lo := details[i*2], details[i*2+1]
				decoded[i] = (nibble(hi) << 4) | nibble(lo)
			}
			details = decoded
		}
		item := map[string]any{"action": action}
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
	s.mu.Lock()
	defer s.mu.Unlock()

	_, _ = s.db.ExecContext(context.Background(),
		`DELETE FROM replay_guard WHERE tenant_id=? AND created_at < ?;`,
		tenantID, time.Now().Add(-maxAge).UTC())

	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO replay_guard(id,tenant_id,created_at) VALUES (?,?,?);`,
		tenantID+":"+provider+":"+nonce, tenantID, time.Now().UTC())
	if err != nil {
		return errors.New("replay detected")
	}
	return nil
}

func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

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
	s.mu.Lock()
	defer s.mu.Unlock()
	scopes, _ := json.Marshal(c.Scopes)
	caps, _ := json.Marshal(c.Capabilities)
	now := time.Now().UTC()
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO connectors(id,tenant_id,provider,version,scopes,capabilities,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) 
		 ON CONFLICT(id,tenant_id) DO UPDATE SET provider=excluded.provider,version=excluded.version,scopes=excluded.scopes,capabilities=excluded.capabilities,status=excluded.status,updated_at=excluded.updated_at;`,
		c.ID, c.TenantID, c.Provider, c.Version, string(scopes), string(caps), c.Status, now, now)
	return err
}

func (s *Store) ListConnectors(tenantID string) ([]ConnectorRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.db.QueryContext(context.Background(),
		`SELECT id,tenant_id,provider,version,scopes,capabilities,status FROM connectors WHERE tenant_id=?;`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []ConnectorRecord
	for rows.Next() {
		var r ConnectorRecord
		var scopesJSON, capsJSON string
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Provider, &r.Version, &scopesJSON, &capsJSON, &r.Status); err != nil {
			continue
		}
		_ = json.Unmarshal([]byte(scopesJSON), &r.Scopes)
		_ = json.Unmarshal([]byte(capsJSON), &r.Capabilities)
		res = append(res, r)
	}
	return res, nil
}

func (s *Store) SetPolicyProfile(tenantID, profile string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO tenant_policy_profiles(tenant_id,profile,updated_at) VALUES (?,?,?) 
		 ON CONFLICT(tenant_id) DO UPDATE SET profile=excluded.profile,updated_at=excluded.updated_at;`,
		tenantID, profile, time.Now().UTC())
	return err
}

func (s *Store) GetPolicyProfile(tenantID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var profile string
	err := s.db.QueryRowContext(context.Background(),
		`SELECT profile FROM tenant_policy_profiles WHERE tenant_id=?;`, tenantID).Scan(&profile)
	if err == sql.ErrNoRows {
		return "moderate", nil
	}
	if err != nil {
		return "", err
	}
	if profile == "" {
		return "moderate", nil
	}
	return profile, nil
}

func (s *Store) GetToken(tenantID, provider string) (accessToken string, scopes []string, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var accessTokenOut, scopesJSON string
	err = s.db.QueryRowContext(context.Background(),
		`SELECT access_token,scopes FROM oauth_tokens WHERE tenant_id=? AND provider=?;`, tenantID, provider).Scan(&accessTokenOut, &scopesJSON)
	if err == sql.ErrNoRows {
		return "", nil, errors.New("token not found")
	}
	if err != nil {
		return "", nil, err
	}
	_ = json.Unmarshal([]byte(scopesJSON), &scopes)
	return accessTokenOut, scopes, nil
}
