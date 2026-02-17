package api

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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

type PlanTier string

const (
	PlanFree       PlanTier = "free"
	PlanPro        PlanTier = "pro"
	PlanEnterprise PlanTier = "enterprise"
)

type SpawnContext struct {
	ParentID         string   `json:"parent_id"`
	Depth            int      `json:"depth"`
	MaxDepth         int      `json:"max_depth"`
	MaxChildren      int      `json:"max_children"`
	BudgetRemaining  int      `json:"budget_remaining"`
	CapabilitySubset []string `json:"capability_subset"`
	ExpiresAt        string   `json:"expires_at,omitempty"`
}

type LLMProviderConfig struct {
	ProviderType string `json:"provider_type"`
	APIKey       string `json:"api_key,omitempty"`
	Endpoint     string `json:"endpoint"`
}

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

func (r *NodeRegistry) Pick(capabilities []string, hostedAllowed bool) (Node, bool) {
	bestScore := int(^uint(0) >> 1)
	var best Node
	found := false
	for _, node := range r.List() {
		if node.Status != "online" {
			continue
		}
		if node.Type == "hosted" && !hostedAllowed {
			continue
		}
		if !supportsAll(node.Capabilities, capabilities) {
			continue
		}
		score := (node.CurrentLoad * 1000) + node.LatencyMS
		if score < bestScore || (score == bestScore && node.ID < best.ID) {
			best = node
			bestScore = score
			found = true
		}
	}
	return best, found
}

type runMeta struct {
	Tier          PlanTier
	Spawn         SpawnContext
	Children      int
	Scopes        []string
	Provider      LLMProviderConfig
	EncryptedKey  string
	LocalOnly     bool
	AssignedNode  string
	HostedAllowed bool
}

type autoControl struct {
	session jobs.AutonomousSession
	cancel  context.CancelFunc
}

type Server struct {
	version string

	store      *jobs.Store
	sql        *storage.SQLiteStore
	registry   *NodeRegistry
	metaMu     sync.RWMutex
	runMeta    map[string]runMeta
	autonomMu  sync.RWMutex
	autonomous map[string]*autoControl

	requestCounter atomic.Uint64
	runsCreated    atomic.Uint64
}

func NewServer(db *storage.SQLiteStore, version string) *Server {
	if strings.TrimSpace(version) == "" {
		version = "dev"
	}
	return &Server{version: version, store: jobs.NewStore(db), sql: db, registry: NewNodeRegistry(), runMeta: map[string]runMeta{}, autonomous: map[string]*autoControl{}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"version": s.version})
	})
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.Handle("POST /v1/runs", s.requireAuth(http.HandlerFunc(s.handleCreateRun)))
	mux.Handle("POST /v1/runs/{id}/spawn", s.requireAuth(http.HandlerFunc(s.handleSpawnRun)))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleRunEvents)))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(http.HandlerFunc(s.handleToolResult)))
	mux.Handle("POST /v1/runs/{id}/export", s.requireAuth(http.HandlerFunc(s.handleExport)))
	mux.Handle("POST /v1/runs/import", s.requireAuth(http.HandlerFunc(s.handleImport)))
	mux.Handle("GET /v1/runs/{id}/audit", s.requireAuth(http.HandlerFunc(s.handleGetAudit)))
	mux.Handle("POST /v1/runs/{id}/gates/{gate_id}", s.requireAuth(http.HandlerFunc(s.handleGateDecision)))
	mux.Handle("GET /v1/plugins", s.requireAuth(http.HandlerFunc(s.handleListPlugins)))
	mux.Handle("GET /v1/metrics", s.requireAuth(http.HandlerFunc(s.handleMetrics)))
	mux.Handle("GET /v1/nodes", s.requireAuth(http.HandlerFunc(s.handleListNodes)))
	mux.Handle("POST /v1/nodes/register", s.requireAuth(http.HandlerFunc(s.handleRegisterNode)))
	mux.Handle("POST /v1/sessions/{id}/autonomous/start", s.requireAuth(http.HandlerFunc(s.handleAutonomousStart)))
	mux.Handle("POST /v1/sessions/{id}/autonomous/stop", s.requireAuth(http.HandlerFunc(s.handleAutonomousStop)))
	mux.Handle("GET /v1/sessions/{id}/autonomous/status", s.requireAuth(http.HandlerFunc(s.handleAutonomousStatus)))
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
		BurstMinSeconds     int      `json:"burst_min_seconds"`
		BurstMaxSeconds     int      `json:"burst_max_seconds"`
		SleepSeconds        int      `json:"sleep_seconds"`
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

	s.autonomMu.Lock()
	if active, ok := s.autonomous[runID]; ok && active.session.Status == jobs.AutonomousRunning {
		s.autonomMu.Unlock()
		writeError(w, http.StatusConflict, "autonomous session already running")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	control := &autoControl{session: sess, cancel: cancel}
	s.autonomous[runID] = control
	s.autonomMu.Unlock()

	burstMin := time.Duration(body.BurstMinSeconds) * time.Second
	if burstMin <= 0 {
		burstMin = 10 * time.Second
	}
	burstMax := time.Duration(body.BurstMaxSeconds) * time.Second
	if burstMax <= 0 {
		burstMax = 30 * time.Second
	}
	sleepInterval := time.Duration(body.SleepSeconds) * time.Second
	if sleepInterval <= 0 {
		sleepInterval = 15 * time.Second
	}
	loop := autonomous.Loop{Store: s.store, Engine: autonomous.StaticEngine{}, IterationTimeout: 15 * time.Second, Scheduler: autonomous.IdleCycleScheduler{BurstMin: burstMin, BurstMax: burstMax, SleepInterval: sleepInterval}}
	go func() {
		reason := loop.Run(ctx, tenantID, runID, &control.session)
		s.autonomMu.Lock()
		defer s.autonomMu.Unlock()
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
	s.autonomMu.Lock()
	defer s.autonomMu.Unlock()
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
	s.autonomMu.RLock()
	defer s.autonomMu.RUnlock()
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

func parseTier(v string) PlanTier {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "pro":
		return PlanPro
	case "enterprise":
		return PlanEnterprise
	default:
		return PlanFree
	}
}

func maxSpawnDepth(t PlanTier) int {
	switch t {
	case PlanPro:
		return 2
	case PlanEnterprise:
		if cfg := strings.TrimSpace(os.Getenv("REACH_ENTERPRISE_MAX_SPAWN_DEPTH")); cfg != "" {
			var v int
			_, _ = fmt.Sscanf(cfg, "%d", &v)
			if v > 0 {
				return v
			}
		}
		return 32
	default:
		return 1
	}
}

func planAllowsHosted(t PlanTier) bool { return t == PlanPro || t == PlanEnterprise }

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Capabilities []string          `json:"capabilities"`
		Scope        []string          `json:"scope"`
		PlanTier     string            `json:"plan_tier"`
		Provider     LLMProviderConfig `json:"provider"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	tenantID := tenantIDFrom(r.Context())
	tier := parseTier(body.PlanTier)
	run, err := s.store.CreateRun(r.Context(), tenantID, body.Capabilities)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	meta := runMeta{Tier: tier, Scopes: body.Scope, Provider: sanitizeProvider(body.Provider)}
	meta.Spawn = SpawnContext{ParentID: "", Depth: 0, MaxDepth: maxSpawnDepth(tier), MaxChildren: 3, BudgetRemaining: 100, CapabilitySubset: body.Capabilities}
	if meta.Provider.APIKey == "" {
		meta.LocalOnly = true
	}
	if body.Provider.APIKey != "" {
		enc, err := encryptSecret(body.Provider.APIKey)
		if err != nil {
			writeError(w, 500, "failed to protect provider key")
			return
		}
		meta.EncryptedKey = enc
	}
	meta.HostedAllowed = planAllowsHosted(tier) && !meta.LocalOnly
	node, ok := s.registry.Pick(body.Capabilities, meta.HostedAllowed)
	if ok {
		meta.AssignedNode = node.ID
		_ = s.store.PublishEvent(r.Context(), run.ID, jobs.Event{Type: "run.node.selected", Payload: mustJSON(map[string]any{"run_id": run.ID, "node_id": node.ID, "node_type": node.Type}), CreatedAt: time.Now().UTC()}, s.requestID(r))
	}
	s.metaMu.Lock()
	s.runMeta[run.ID] = meta
	s.metaMu.Unlock()
	s.runsCreated.Add(1)
	writeJSON(w, 201, map[string]any{"run_id": run.ID, "tenant_id": tenantID, "node_selected": ok, "local_only": meta.LocalOnly})
}

func (s *Server) handleSpawnRun(w http.ResponseWriter, r *http.Request) {
	parentID := r.PathValue("id")
	tenantID := tenantIDFrom(r.Context())
	_, err := s.store.GetRun(r.Context(), tenantID, parentID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	var body struct {
		Capabilities []string `json:"capabilities"`
		Scope        []string `json:"scope"`
		BudgetSlice  int      `json:"budget_slice"`
		TTLSeconds   int      `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	s.metaMu.Lock()
	parent, ok := s.runMeta[parentID]
	if !ok {
		s.metaMu.Unlock()
		writeError(w, 404, "run metadata missing")
		return
	}
	deny := func(reason string) {
		s.metaMu.Unlock()
		_ = s.store.PublishEvent(r.Context(), parentID, jobs.Event{Type: "spawn.denied", Payload: mustJSON(map[string]any{"parent_id": parentID, "reason": reason}), CreatedAt: time.Now().UTC()}, s.requestID(r))
		writeError(w, 403, reason)
	}
	if parent.Spawn.Depth+1 > parent.Spawn.MaxDepth {
		deny("max spawn depth exceeded")
		return
	}
	if parent.Children >= parent.Spawn.MaxChildren {
		deny("max children exceeded")
		return
	}
	if !supportsAll(parent.Spawn.CapabilitySubset, body.Capabilities) {
		deny("child capabilities exceed parent")
		return
	}
	if len(body.Scope) > 0 && !supportsAll(parent.Scopes, body.Scope) {
		deny("child scope exceeds parent")
		return
	}
	if body.BudgetSlice <= 0 || body.BudgetSlice > parent.Spawn.BudgetRemaining {
		deny("invalid budget slice")
		return
	}

	child, err := s.store.CreateRun(r.Context(), tenantID, body.Capabilities)
	if err != nil {
		s.metaMu.Unlock()
		writeError(w, 500, err.Error())
		return
	}
	parent.Children++
	parent.Spawn.BudgetRemaining -= body.BudgetSlice
	s.runMeta[parentID] = parent
	ttl := time.Duration(body.TTLSeconds) * time.Second
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	exp := time.Now().UTC().Add(ttl)
	childMeta := runMeta{Tier: parent.Tier, Scopes: body.Scope, Provider: parent.Provider, EncryptedKey: parent.EncryptedKey, LocalOnly: parent.LocalOnly}
	childMeta.Spawn = SpawnContext{ParentID: parentID, Depth: parent.Spawn.Depth + 1, MaxDepth: parent.Spawn.MaxDepth, MaxChildren: parent.Spawn.MaxChildren, BudgetRemaining: body.BudgetSlice, CapabilitySubset: body.Capabilities, ExpiresAt: exp.Format(time.RFC3339Nano)}
	childMeta.HostedAllowed = parent.HostedAllowed
	s.runMeta[child.ID] = childMeta
	s.metaMu.Unlock()
	go s.expireChild(child.ID, exp)
	writeJSON(w, 201, map[string]any{"run_id": child.ID, "spawn_context": childMeta.Spawn})
}

func (s *Server) expireChild(runID string, at time.Time) {
	t := time.NewTimer(time.Until(at))
	defer t.Stop()
	<-t.C
	s.metaMu.Lock()
	meta, ok := s.runMeta[runID]
	if ok {
		meta.Spawn.BudgetRemaining = 0
		s.runMeta[runID] = meta
	}
	s.metaMu.Unlock()
	_ = s.store.PublishEvent(context.Background(), runID, jobs.Event{Type: "spawn.expired", Payload: mustJSON(map[string]any{"run_id": runID, "expired_at": at.Format(time.RFC3339Nano)}), CreatedAt: time.Now().UTC()}, "system")
}

func sanitizeProvider(p LLMProviderConfig) LLMProviderConfig {
	p.ProviderType = strings.ToLower(strings.TrimSpace(p.ProviderType))
	p.Endpoint = strings.TrimSpace(p.Endpoint)
	p.APIKey = strings.TrimSpace(p.APIKey)
	return p
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
	tenantID, runID := tenantIDFrom(r.Context()), r.PathValue("id")
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
		_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "policy.gate.requested", Payload: mustJSON(map[string]any{"gate_id": gateID, "reason": err.Error()}), CreatedAt: time.Now().UTC()}, s.requestID(r))
		writeError(w, 403, err.Error())
		return
	}
	payload := mustJSON(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleGateDecision(w http.ResponseWriter, r *http.Request) {
	if err := s.store.ResolveGate(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), r.PathValue("gate_id"), jobs.GateDecision("approve_once")); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"plugins": loadPlugins()})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	tenantID, runID := tenantIDFrom(r.Context()), r.PathValue("id")
	history, err := s.store.EventHistory(r.Context(), tenantID, runID, 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	audit, _ := s.store.ListAudit(r.Context(), tenantID, runID)
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	writeZip := func(name string, body []byte) { f, _ := zw.Create(name); _, _ = f.Write(body) }
	writeZip("manifest.json", mustJSON(map[string]any{"version": "0.1.0", "run_id": runID}))
	var events bytes.Buffer
	for _, e := range history {
		events.Write(e.Payload)
		events.WriteByte('\n')
	}
	writeZip("events.ndjson", events.Bytes())
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
		writeError(w, 400, "invalid capsule")
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
		writeError(w, 400, "events.ndjson missing")
		return
	}
	defer eventsFile.Close()
	run, err := s.store.CreateRun(r.Context(), tenantIDFrom(r.Context()), nil)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	lines, _ := io.ReadAll(eventsFile)
	for _, line := range strings.Split(strings.TrimSpace(string(lines)), "\n") {
		if strings.TrimSpace(line) != "" {
			_ = s.store.PublishEvent(r.Context(), run.ID, jobs.Event{Type: "replay.event", Payload: []byte(line), CreatedAt: time.Now().UTC()}, "import")
		}
	}
	writeJSON(w, 201, map[string]string{"run_id": run.ID, "mode": "replay"})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.ListAudit(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"entries": entries})
}

func (s *Server) handleRunEvents(w http.ResponseWriter, r *http.Request) {
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
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

func (s *Server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]uint64{"runs_created": s.runsCreated.Load()})
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

func encryptSecret(raw string) (string, error) {
	k := sha256.Sum256([]byte(strings.TrimSpace(os.Getenv("REACH_KEY_ENCRYPTION_SECRET")) + "::reach"))
	block, err := aes.NewCipher(k[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(raw), nil)
	return base64.StdEncoding.EncodeToString(append(nonce, ciphertext...)), nil
}

func (s *Server) randomID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func hashID(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:8]) }

func (s *Server) requestID(r *http.Request) string {
	if rid := strings.TrimSpace(r.Header.Get("X-Request-ID")); rid != "" {
		return rid
	}
	return fmt.Sprintf("req-%d", s.requestCounter.Add(1))
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }

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
