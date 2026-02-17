package api

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/autonomous"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

type ctxKey string

const tenantKey ctxKey = "tenant"

type autoControl struct {
	session jobs.AutonomousSession
	cancel  context.CancelFunc
}

type Server struct {
	store          *jobs.Store
	sql            *storage.SQLiteStore
	requestCounter atomic.Uint64

	runsCreated, toolCalls, denials, approvals, failures, exports, imports atomic.Uint64
	mu                                                                     sync.RWMutex
	autonomous                                                             map[string]*autoControl
}

func NewServer(db *storage.SQLiteStore) *Server {
	return &Server{store: jobs.NewStore(db), sql: db, autonomous: map[string]*autoControl{}}
type Node struct {
	ID           string   `json:"id"`
	Type         string   `json:"type"`
	Capabilities []string `json:"capabilities"`
	CurrentLoad  int      `json:"current_load"`
	LatencyMS    int      `json:"latency_ms"`
	Status       string   `json:"status"`
}

type NodeRegistry struct {
	mu    sync.RWMutex
	nodes map[string]Node
}

func NewNodeRegistry() *NodeRegistry { return &NodeRegistry{nodes: map[string]Node{}} }

func (r *NodeRegistry) Register(node Node) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nodes[node.ID] = node
}

func (r *NodeRegistry) List() []Node {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Node, 0, len(r.nodes))
	for _, n := range r.nodes {
		out = append(out, n)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (r *NodeRegistry) Pick(capabilities []string) (Node, bool) {
	nodes := r.List()
	bestScore := int(^uint(0) >> 1)
	var best Node
	found := false
	for _, node := range nodes {
		if node.Status != "online" {
			continue
		}
		if !supportsAll(node.Capabilities, capabilities) {
			continue
		}
		score := (node.CurrentLoad * 1000) + node.LatencyMS
		if score < bestScore || (score == bestScore && node.ID < best.ID) {
			bestScore = score
			best = node
			found = true
		}
	}
	return best, found
}

func supportsAll(have, need []string) bool {
	set := map[string]struct{}{}
	for _, h := range have {
		set[h] = struct{}{}
	}
	for _, n := range need {
		if _, ok := set[n]; !ok {
			return false
		}
	}
	return true
}

type Server struct {
	store      *jobs.Store
	sql        *storage.SQLiteStore
	registry   *NodeRegistry
	runToNode  map[string]string
	runToNodeM sync.RWMutex

	requestCounter atomic.Uint64
	runsCreated    atomic.Uint64
}

func NewServer(db *storage.SQLiteStore) *Server {
	return &Server{store: jobs.NewStore(db), sql: db, registry: NewNodeRegistry(), runToNode: map[string]string{}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.Handle("POST /v1/runs", s.requireAuth(http.HandlerFunc(s.handleCreateRun)))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleStreamEvents)))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(http.HandlerFunc(s.handleToolResult)))
	mux.Handle("GET /v1/runs/{id}/audit", s.requireAuth(http.HandlerFunc(s.handleGetAudit)))
	mux.Handle("POST /v1/runs/{id}/export", s.requireAuth(http.HandlerFunc(s.handleExport)))
	mux.Handle("POST /v1/runs/import", s.requireAuth(http.HandlerFunc(s.handleImport)))
	mux.Handle("POST /v1/runs/{id}/gates/{gate_id}", s.requireAuth(http.HandlerFunc(s.handleGateDecision)))
	mux.Handle("GET /v1/plugins", s.requireAuth(http.HandlerFunc(s.handleListPlugins)))
	mux.Handle("GET /v1/metrics", s.requireAuth(http.HandlerFunc(s.handleMetrics)))
	mux.Handle("POST /v1/plugins/verify", s.requireAuth(http.HandlerFunc(s.handleVerifyPlugin)))
	mux.Handle("POST /v1/sessions/{id}/autonomous/start", s.requireAuth(http.HandlerFunc(s.handleAutonomousStart)))
	mux.Handle("POST /v1/sessions/{id}/autonomous/stop", s.requireAuth(http.HandlerFunc(s.handleAutonomousStop)))
	mux.Handle("GET /v1/sessions/{id}/autonomous/status", s.requireAuth(http.HandlerFunc(s.handleAutonomousStatus)))
	return s.withRequestLogging(mux)
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleRunEvents)))
	mux.Handle("GET /v1/nodes", s.requireAuth(http.HandlerFunc(s.handleListNodes)))
	mux.Handle("POST /v1/nodes/register", s.requireAuth(http.HandlerFunc(s.handleRegisterNode)))
	mux.Handle("GET /v1/admin/dashboard", s.requireAuth(http.HandlerFunc(s.handleDashboard)))
	return mux
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

func (s *Server) handleAutonomousStart(w http.ResponseWriter, r *http.Request) {
	tenantID, runID := tenantIDFrom(r.Context()), r.PathValue("id")
	var body struct {
		Goal                string   `json:"goal"`
		MaxIterations       int      `json:"max_iterations"`
		MaxRuntimeSeconds   int      `json:"max_runtime"`
		MaxToolCalls        int      `json:"max_tool_calls"`
		AllowedCapabilities []string `json:"allowed_capabilities"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.MaxIterations <= 0 {
		body.MaxIterations = 25
	}
	if body.MaxRuntimeSeconds <= 0 {
		body.MaxRuntimeSeconds = 300
	}
	sess := jobs.AutonomousSession{Goal: body.Goal, MaxIterations: body.MaxIterations, MaxRuntime: time.Duration(body.MaxRuntimeSeconds) * time.Second, MaxToolCalls: body.MaxToolCalls, AllowedCapabilities: body.AllowedCapabilities, Status: jobs.AutonomousRunning, StartedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}

	s.mu.Lock()
	if active, ok := s.autonomous[runID]; ok && active.session.Status == jobs.AutonomousRunning {
		s.mu.Unlock()
		writeError(w, http.StatusConflict, "autonomous session already running")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	control := &autoControl{session: sess, cancel: cancel}
	s.autonomous[runID] = control
	s.mu.Unlock()

	loop := autonomous.Loop{Store: s.store, Engine: autonomous.StaticEngine{}, IterationTimeout: 15 * time.Second}
	go func() {
		reason := loop.Run(ctx, tenantID, runID, &control.session)
		s.mu.Lock()
		defer s.mu.Unlock()
		if reason == autonomous.ReasonDone {
			control.session.Status = jobs.AutonomousCompleted
		} else {
			control.session.Status = jobs.AutonomousStopped
		}
		control.session.StopReason = string(reason)
		control.session.UpdatedAt = time.Now().UTC()
		payload, _ := json.Marshal(map[string]any{"reason": reason, "iteration_count": control.session.IterationCount})
		_ = s.store.PublishEvent(context.Background(), runID, jobs.Event{Type: "autonomous.stopped", Payload: payload, CreatedAt: time.Now().UTC()}, "autonomous")
	}()
	writeJSON(w, http.StatusAccepted, map[string]any{"status": control.session.Status, "run_id": runID})
}

func (s *Server) handleAutonomousStop(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	s.mu.Lock()
	defer s.mu.Unlock()
	control, ok := s.autonomous[runID]
	if !ok {
		writeError(w, http.StatusNotFound, "autonomous session not found")
		return
	}
	control.session.Status = jobs.AutonomousStopping
	control.session.StopReason = string(autonomous.ReasonManualStop)
	control.cancel()
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopping"})
}

func (s *Server) handleAutonomousStatus(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	s.mu.RLock()
	defer s.mu.RUnlock()
	control, ok := s.autonomous[runID]
	if !ok {
		writeError(w, http.StatusNotFound, "autonomous session not found")
		return
	}
	writeJSON(w, http.StatusOK, control.session)
}

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
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Reach-Env")), "prod") {
		writeError(w, 403, "disabled in prod")
		return
	}
	uid := "dev-user"
	s.setSession(w, r.Context(), uid, uid)
	writeJSON(w, 200, map[string]string{"tenant_id": uid})
}

func (s *Server) setSession(w http.ResponseWriter, ctx context.Context, tenantID, userID string) {
	sid := s.randomID("sess")
	now := time.Now().UTC()
	_ = s.sql.PutSession(ctx, storage.SessionRecord{ID: sid, TenantID: tenantID, UserID: userID, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)})
	http.SetCookie(w, &http.Cookie{Name: "reach_session", Value: sid, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
}

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	tenantID := tenantIDFrom(r.Context())
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
	requestID := s.requestID(r)
	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if err := s.store.CheckCapabilities(r.Context(), tenantID, runID, body.RequiredCapabilities); err != nil {
		gateID := fmt.Sprintf("gate-%d", time.Now().UnixNano())
		_ = s.store.SetGate(r.Context(), runID, jobs.Gate{ID: gateID, Tool: body.ToolName, Capabilities: body.RequiredCapabilities, Reason: err.Error()})
		payload, _ := json.Marshal(map[string]any{"run_id": runID, "tool": body.ToolName, "capabilities": body.RequiredCapabilities, "reason": err.Error(), "gate_id": gateID})
		_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "policy.gate.requested", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	payload, _ := json.Marshal(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
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
	if err := s.store.ResolveGate(r.Context(), runID, gateID, body.Decision); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"plugins": loadPlugins()})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantIDFrom(r.Context())
	runID := r.PathValue("id")
	history, err := s.store.EventHistory(r.Context(), tenantID, runID, 0)
	node, ok := s.registry.Pick(body.Capabilities)
	if ok {
		s.runToNodeM.Lock()
		s.runToNode[run.ID] = node.ID
		s.runToNodeM.Unlock()
		_, _ = s.store.AppendEvent(r.Context(), tenantID, run.ID, jobs.Event{Type: "run.node.selected", Payload: mustJSON(map[string]any{"run_id": run.ID, "node_id": node.ID, "node_type": node.Type}), CreatedAt: time.Now().UTC()})
	}
	writeJSON(w, 201, map[string]any{"run_id": run.ID, "tenant_id": tenantID, "node_selected": ok})
}

func (s *Server) handleRunEvents(w http.ResponseWriter, r *http.Request) {
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	audit, _ := s.store.ListAudit(r.Context(), tenantID, runID)
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	writeZip := func(name string, body []byte) { f, _ := zw.Create(name); _, _ = f.Write(body) }
	manifest, _ := json.Marshal(map[string]any{"version": "0.1.0", "run_id": runID, "files": []string{"events.ndjson", "toolcalls.ndjson", "audit.ndjson"}})
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
	tenantID := tenantIDFrom(r.Context())
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
	run, err := s.store.CreateRun(r.Context(), tenantID, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	lines, _ := io.ReadAll(eventsFile)
	for _, line := range strings.Split(strings.TrimSpace(string(lines)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		_ = s.store.PublishEvent(r.Context(), run.ID, jobs.Event{Type: "replay.event", Payload: []byte(line), CreatedAt: time.Now().UTC()}, "import")
	}
	writeJSON(w, http.StatusCreated, map[string]string{"run_id": run.ID, "mode": "replay"})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.ListAudit(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantIDFrom(r.Context())
	runID := r.PathValue("id")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")
	history, _ := s.store.EventHistory(r.Context(), tenantID, runID, 0)
	for _, evt := range history {
		fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", evt.ID, evt.Type, evt.Payload)
	}
	flusher.Flush()
	ch, cancel := s.store.Subscribe(runID)
	defer cancel()
	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-ch:
			fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", evt.ID, evt.Type, evt.Payload)
			flusher.Flush()
		}
	}
	writeJSON(w, 200, map[string]any{"events": events})
}

func (s *Server) handleListNodes(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"nodes": s.registry.List()})
}

func (s *Server) handleRegisterNode(w http.ResponseWriter, r *http.Request) {
	var node Node
	if err := json.NewDecoder(r.Body).Decode(&node); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if node.ID == "" || node.Status == "" {
		writeError(w, 400, "node id and status are required")
		return
	}
	s.registry.Register(node)
	writeJSON(w, 201, map[string]string{"status": "registered"})
}

func (s *Server) handleDashboard(w http.ResponseWriter, _ *http.Request) {
	nodes := s.registry.List()
	totalLatency := 0
	for _, n := range nodes {
		totalLatency += n.LatencyMS
	}
	avgLatency := 0
	if len(nodes) > 0 {
		avgLatency = totalLatency / len(nodes)
	}
	keyID, err := plugins.VerifyManifest(body.ManifestPath, body.SignaturePath, keyFile, os.Getenv("DEV_ALLOW_UNSIGNED") == "1")
	status := "verified"
	if err != nil {
		status = "rejected"
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
	writeJSON(w, 200, map[string]any{
		"active_sessions": 1,
		"nodes":           nodes,
		"latency_ms_avg":  avgLatency,
		"run_count":       s.runsCreated.Load(),
	})
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (s *Server) randomID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func hashID(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:8]) }

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

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
