package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/plugins"
	"reach/services/runner/internal/storage"
)

type ctxKey string

const tenantKey ctxKey = "tenant"

type Server struct {
	store                                                                  *jobs.Store
	sql                                                                    *storage.SQLiteStore
	requestCounter                                                         atomic.Uint64
	runsCreated, toolCalls, denials, approvals, failures, exports, imports atomic.Uint64
}

func NewServer(db *storage.SQLiteStore) *Server { return &Server{store: jobs.NewStore(db), sql: db} }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /auth/login", s.handleLogin)
	mux.HandleFunc("GET /auth/callback", s.handleCallback)
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.HandleFunc("POST /auth/logout", s.handleLogout)
	mux.Handle("POST /v1/runs", s.requireAuth(http.HandlerFunc(s.handleCreateRun)))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleStreamEvents)))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(http.HandlerFunc(s.handleToolResult)))
	mux.Handle("GET /v1/runs/{id}/audit", s.requireAuth(http.HandlerFunc(s.handleGetAudit)))
	mux.Handle("GET /v1/metrics", s.requireAuth(http.HandlerFunc(s.handleMetrics)))
	mux.Handle("POST /v1/plugins/verify", s.requireAuth(http.HandlerFunc(s.handleVerifyPlugin)))
	return s.withRequestLogging(mux)
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("reach_session")
		if err != nil {
			writeError(w, 401, "auth required")
			return
		}
		sess, err := s.sql.GetSession(r.Context(), c.Value)
		if err != nil || sess.ExpiresAt.Before(time.Now()) {
			writeError(w, 401, "invalid session")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), tenantKey, sess.TenantID)))
	})
}

func tenantIDFrom(ctx context.Context) string { v, _ := ctx.Value(tenantKey).(string); return v }

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	redirect := os.Getenv("GITHUB_REDIRECT_URL")
	if clientID == "" || redirect == "" {
		writeError(w, 503, "github oauth is not configured")
		return
	}
	state := s.randomID("state")
	http.Redirect(w, r, fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=read:user&state=%s", clientID, redirect, state), http.StatusFound)
}
func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(r.URL.Query().Get("code")) == "" {
		writeError(w, 400, "missing code")
		return
	}
	user := "gh-" + hashID(r.URL.Query().Get("code"))
	s.setSession(w, r.Context(), user, user)
	writeJSON(w, 200, map[string]string{"tenant_id": user})
}
func (s *Server) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("ENV") == "prod" {
		writeError(w, 403, "disabled in prod")
		return
	}
	uid := os.Getenv("DEV_USER_ID")
	if uid == "" {
		uid = "dev-user"
	}
	s.setSession(w, r.Context(), uid, uid)
	writeJSON(w, 200, map[string]string{"tenant_id": uid})
}
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("reach_session")
	if err == nil {
		_ = s.sql.DeleteSession(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "reach_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, 200, map[string]string{"status": "logged_out"})
}
func (s *Server) setSession(w http.ResponseWriter, ctx context.Context, tenantID, userID string) {
	sid := s.randomID("sess")
	now := time.Now().UTC()
	_ = s.sql.PutSession(ctx, storage.SessionRecord{ID: sid, TenantID: tenantID, UserID: userID, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)})
	http.SetCookie(w, &http.Cookie{Name: "reach_session", Value: sid, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
}

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantIDFrom(r.Context())
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	run, err := s.store.CreateRun(r.Context(), tenantID, body.Capabilities)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	s.runsCreated.Add(1)
	writeJSON(w, 201, map[string]string{"run_id": run.ID, "tenant_id": tenantID, "request_id": s.requestID(r)})
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
	tenantID, runID := tenantIDFrom(r.Context()), r.PathValue("id")
	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
		Sensitive            bool           `json:"sensitive"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if err := s.store.CheckCapabilities(r.Context(), tenantID, runID, body.RequiredCapabilities); err != nil {
		s.denials.Add(1)
		writeError(w, 403, err.Error())
		return
	}
	payload, _ := json.Marshal(map[string]any{"tool_name": body.ToolName, "result": body.Result, "sensitive": body.Sensitive})
	if body.Sensitive {
		payload = []byte(`{"tool_name":"` + body.ToolName + `","result":"[REDACTED]","sensitive":true}`)
	}
	_, err := s.store.AppendEvent(r.Context(), tenantID, runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	s.toolCalls.Add(1)
	_ = s.store.Audit(r.Context(), tenantID, runID, "tool.result.received", redact(payload))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.ListAudit(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"entries": entries})
}

func (s *Server) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	tenantID, runID := tenantIDFrom(r.Context()), r.PathValue("id")
	after := int64(0)
	if v := r.Header.Get("Last-Event-ID"); v != "" {
		if p, err := strconv.ParseInt(v, 10, 64); err == nil {
			after = p
		}
	}
	history, err := s.store.EventHistory(r.Context(), tenantID, runID, after)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	for _, e := range history {
		fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", e.ID, e.Type, e.Payload)
	}
	flusher.Flush()
	ch, unsub := s.store.Subscribe(runID)
	defer unsub()
	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-ch:
			fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", evt.ID, evt.Type, evt.Payload)
			flusher.Flush()
		case <-time.After(15 * time.Second):
			fmt.Fprint(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")
			flusher.Flush()
		}
	}
}

func (s *Server) handleVerifyPlugin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ManifestPath  string `json:"manifest_path"`
		SignaturePath string `json:"signature_path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	keyFile := os.Getenv("PLUGIN_TRUSTED_KEYS")
	if keyFile == "" {
		keyFile = "services/runner/config/trusted_plugin_keys.json"
	}
	keyID, err := plugins.VerifyManifest(body.ManifestPath, body.SignaturePath, keyFile, os.Getenv("DEV_ALLOW_UNSIGNED") == "1")
	status := "verified"
	if err != nil {
		status = "rejected"
		s.denials.Add(1)
	}
	auditBody, _ := json.Marshal(map[string]any{"plugin_manifest": body.ManifestPath, "key_id": keyID, "result": status, "error": fmt.Sprint(err)})
	_ = s.store.Audit(r.Context(), tenantIDFrom(r.Context()), "", "plugin.verify", auditBody)
	if err != nil {
		writeError(w, 403, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": status, "key_id": keyID})
}
func (s *Server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]uint64{"runs_created": s.runsCreated.Load(), "tool_calls": s.toolCalls.Load(), "denials": s.denials.Load(), "approvals": s.approvals.Load(), "failures": s.failures.Load(), "exports": s.exports.Load(), "imports": s.imports.Load()})
}

func (s *Server) requestID(r *http.Request) string {
	if rid := strings.TrimSpace(r.Header.Get("X-Request-Id")); rid != "" {
		return rid
	}
	return fmt.Sprintf("req-%09d", s.requestCounter.Add(1))
}
func (s *Server) withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := s.requestID(r)
		log.Printf("request method=%s path=%s request_id=%s tenant_id=%s", r.Method, r.URL.Path, rid, tenantIDFrom(r.Context()))
		next.ServeHTTP(w, r)
	})
}
func (s *Server) randomID(prefix string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}
func hashID(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:8]) }
func redact(in []byte) []byte {
	s := string(in)
	for _, k := range []string{"token", "secret", "password", "authorization"} {
		s = strings.ReplaceAll(strings.ToLower(s), k, "[redacted]")
	}
	return []byte(s)
}
func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}
func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
