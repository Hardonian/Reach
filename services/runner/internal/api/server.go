package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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
	store          *jobs.Store
	requestCounter atomic.Uint64
	plugins        []PluginManifest
}

func NewServer(store *jobs.Store) *Server {
	return &Server{store: store, plugins: loadPlugins()}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/runs", s.handleCreateRun)
	mux.HandleFunc("GET /v1/runs/{id}/events", s.handleStreamEvents)
	mux.HandleFunc("POST /v1/runs/{id}/tool-result", s.handleToolResult)
	mux.HandleFunc("GET /v1/runs/{id}/audit", s.handleGetAudit)
	mux.HandleFunc("POST /v1/runs/{id}/export", s.handleExport)
	mux.HandleFunc("POST /v1/runs/import", s.handleImport)
	mux.HandleFunc("POST /v1/runs/{id}/gates/{gate_id}", s.handleGateDecision)
	mux.HandleFunc("GET /v1/plugins", s.handleListPlugins)
	return mux
}

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	requestID := s.requestID(r)
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	run := s.store.CreateRun(requestID, body.Capabilities)
	writeJSON(w, http.StatusCreated, map[string]string{"run_id": run.ID, "request_id": requestID})
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
	requestID := s.requestID(r)
	runID := r.PathValue("id")
	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}

	pluginID, pluginCaps := requiredPluginCapabilities(s.plugins, body.ToolName)
	required := append([]string(nil), body.RequiredCapabilities...)
	required = append(required, pluginCaps...)
	if err := s.store.CheckCapabilities(runID, required); err != nil {
		gateID := fmt.Sprintf("gate-%d", time.Now().UnixNano())
		_ = s.store.SetGate(runID, jobs.Gate{ID: gateID, Tool: body.ToolName, Capabilities: required, Reason: err.Error()})
		payload, _ := json.Marshal(map[string]any{"run_id": runID, "tool": body.ToolName, "capabilities": required, "reason": err.Error(), "gate_id": gateID})
		_ = s.store.PublishEvent(runID, jobs.Event{Type: "policy.gate.requested", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
		_ = s.store.Audit(runID, requestID, "policy.gate.requested", map[string]any{"gate_id": gateID, "tool": body.ToolName, "plugin_id": pluginID})
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	_ = s.store.Audit(runID, requestID, "tool.result.received", map[string]any{"tool_name": body.ToolName, "plugin_id": pluginID, "result": body.Result})
	payload, _ := json.Marshal(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "request_id": requestID})
}

func (s *Server) handleGateDecision(w http.ResponseWriter, r *http.Request) {
	runID, gateID := r.PathValue("id"), r.PathValue("gate_id")
	var body struct {
		Decision jobs.GateDecision `json:"decision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := s.store.ResolveGate(runID, gateID, body.Decision); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	payload, _ := json.Marshal(map[string]any{"gate_id": gateID, "decision": body.Decision})
	_ = s.store.PublishEvent(runID, jobs.Event{Type: "policy.gate.resolved", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"plugins": s.plugins})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	history, err := s.store.EventHistory(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	audit, _ := s.store.ListAudit(runID)
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	writeZip := func(name string, body []byte) { f, _ := zw.Create(name); _, _ = f.Write(body) }
	manifest, _ := json.Marshal(map[string]any{"version": "0.1.0", "run_id": runID, "created_at": "1970-01-01T00:00:00Z", "files": []string{"events.ndjson", "toolcalls.ndjson", "audit.ndjson"}})
	writeZip("manifest.json", manifest)
	var events bytes.Buffer
	for _, e := range history {
		events.Write(e.Payload)
		events.WriteByte('\n')
	}
	writeZip("events.ndjson", events.Bytes())
	writeZip("toolcalls.ndjson", []byte(""))
	var audits bytes.Buffer
	for _, a := range audit {
		line, _ := json.Marshal(a)
		audits.Write(line)
		audits.WriteByte('\n')
	}
	writeZip("audit.ndjson", audits.Bytes())
	_ = zw.Close()
	w.Header().Set("Content-Type", "application/zip")
	_, _ = w.Write(buf.Bytes())
}

func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	data, _ := io.ReadAll(r.Body)
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid capsule")
		return
	}
	var eventsFile io.ReadCloser
	for _, f := range zr.File {
		if f.Name == "events.ndjson" {
			eventsFile, _ = f.Open()
			break
		}
	}
	if eventsFile == nil {
		writeError(w, http.StatusBadRequest, "events.ndjson missing")
		return
	}
	defer eventsFile.Close()
	run := s.store.CreateRun(s.requestID(r), nil)
	lines, _ := io.ReadAll(eventsFile)
	for _, line := range strings.Split(strings.TrimSpace(string(lines)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		_ = s.store.PublishEvent(run.ID, jobs.Event{Type: "replay.event", Payload: []byte(line), CreatedAt: time.Now().UTC()}, "import")
	}
	writeJSON(w, http.StatusCreated, map[string]string{"run_id": run.ID, "mode": "replay"})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.ListAudit(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	run, err := s.store.GetRun(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")
	history, _ := s.store.EventHistory(run.ID)
	for _, evt := range history {
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", sanitizeEventName(evt.Type), evt.Payload)
	}
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-ch:
			fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", evt.ID, evt.Type, evt.Payload)
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

var _ = errors.Is

type PluginManifest struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Version string       `json:"version"`
	Tools   []PluginTool `json:"tools"`
}

type PluginTool struct {
	Name                 string   `json:"name"`
	RequiredCapabilities []string `json:"required_capabilities"`
}

func loadPlugins() []PluginManifest {
	dirs := []string{"services/runner/plugins", "../plugins", "plugins"}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		out := make([]PluginManifest, 0)
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, e.Name(), "manifest.json"))
			if err != nil {
				continue
			}
			var m PluginManifest
			if json.Unmarshal(data, &m) == nil && m.ID != "" {
				out = append(out, m)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return []PluginManifest{}
}

func requiredPluginCapabilities(plugins []PluginManifest, tool string) (string, []string) {
	for _, p := range plugins {
		for _, t := range p.Tools {
			if t.Name == tool {
				return p.ID, t.RequiredCapabilities
			}
		}
	}
	return "", nil
}
