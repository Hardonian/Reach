package api

import (
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"reach/core/config/tenant"
	"reach/services/runner/internal/adaptive"
	"reach/services/runner/internal/arcade/gamification"
	"reach/services/runner/internal/consensus"
	"reach/services/runner/internal/federation"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/model"
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
	CapabilitySubset []string `json:"capability_subset"`
}

type runMeta struct {
	Tier     PlanTier
	Spawn    SpawnContext
	Children int
}

type Server struct {
	version        string
	store          *jobs.Store
	queue          *jobs.DurableQueue
	sql            *storage.SQLiteStore
	registry       *NodeRegistry
	metaMu         sync.RWMutex
	runMeta        map[string]runMeta
	autonomousMu   sync.RWMutex
	autonomous     map[string]*autoControl
	metrics        *metrics
	shareMu        sync.RWMutex
	shareViews     map[string]map[string]any
	handshakeMu    sync.RWMutex
	handshakes     map[string]mobileHandshakeChallenge
	requestCounter atomic.Uint64
	federation     *federation.Coordinator
	gamification   *gamification.Store
	consensus      *consensus.ConsensusManager // New: BFT Consensus
	runsCreated    atomic.Uint64
	spawnAttempts  atomic.Uint64
	spawnDenied    atomic.Uint64
	toolCalls      atomic.Uint64
	rateLimiter    *RateLimiterMiddleware
	adaptiveEngine *adaptive.Engine
}

func NewServer(db *storage.SQLiteStore, version string) *Server {
	if strings.TrimSpace(version) == "" {
		version = "dev"
	}
	m := newMetrics()
	dataRoot := strings.TrimSpace(os.Getenv("REACH_DATA_DIR"))
	if dataRoot == "" {
		dataRoot = "data"
	}
	fed := federation.NewCoordinator(filepath.Join(dataRoot, "federation_reputation.json"))
	_ = fed.Load()
	game := gamification.NewStore(filepath.Join(dataRoot, "gamification.json"))
	_ = game.Load()

	server := &Server{
		version:      version,
		store:        jobs.NewStore(db),
		queue:        jobs.NewDurableQueue(db),
		sql:          db,
		registry:     NewNodeRegistry(),
		runMeta:      map[string]runMeta{},
		autonomous:   map[string]*autoControl{},
		metrics:      m,
		shareMu:      sync.RWMutex{},
		shareViews:   map[string]map[string]any{},
		handshakeMu:  sync.RWMutex{},
		handshakes:   map[string]mobileHandshakeChallenge{},
		federation:   fed,
		gamification: game,
		rateLimiter:  NewRateLimiterMiddleware(DefaultRateLimitConfig()),
	}
	server.initAdaptiveEngine()
	server.consensus = consensus.NewConsensusManager()
	server.store.WithObserver(server.observeEvent)
	return server
}

type mobileHandshakeChallenge struct {
	Challenge string
	NodeID    string
	OrgID     string
	PubKey    string
	IssuedAt  time.Time
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.HandleFunc("POST /internal/v1/triggers", s.handleInternalTrigger)
	mux.Handle("POST /v1/runs", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleCreateRun))))
	mux.Handle("POST /v1/runs/{id}/spawn", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleSpawnRun))))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleToolResult))))
	mux.Handle("POST /v1/mobile/handshake/challenge", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleMobileHandshakeChallenge))))
	mux.Handle("POST /v1/mobile/handshake/complete", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleMobileHandshakeComplete))))
	mux.Handle("POST /v1/mobile/policy/preflight", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleMobilePolicyPreflight))))
	mux.Handle("GET /v1/mobile/runs/{id}", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleMobileRunView))))
	mux.Handle("POST /v1/mobile/share-tokens", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleCreateShareToken))))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleRunEvents))))
	mux.Handle("GET /v1/runs/{id}/consensus", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetConsensusProof))))
	mux.Handle("GET /v1/runs/{id}/zk-verify", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetZKVerifyProof))))
	mux.HandleFunc("GET /v1/mobile/share/{token}", s.handleFetchSharedRun)
	mux.Handle("POST /v1/runs/{id}/export", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleExport))))
	mux.Handle("POST /v1/runs/import", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleImport))))
	mux.Handle("GET /v1/runs/{id}/audit", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetAudit))))
	mux.Handle("GET /v1/runs/{id}/strategy", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetStrategy))))
	mux.Handle("GET /v1/runs/{id}/simulate", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleSimulateOptions))))
	mux.Handle("POST /v1/runs/{id}/replay", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleReplayRun))))
	mux.Handle("POST /v1/runs/{id}/gates/{gate_id}", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGateDecision))))
	mux.Handle("GET /v1/plugins", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleListPlugins))))
	mux.HandleFunc("GET /metrics", s.handlePromMetrics)
	mux.Handle("GET /v1/metrics", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleMetrics))))
	mux.Handle("POST /v1/nodes/register", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleRegisterNode))))
	mux.Handle("POST /v1/nodes/heartbeat", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleNodeHeartbeat))))
	mux.Handle("GET /v1/nodes", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleListNodes))))
	mux.Handle("POST /v1/sessions/{id}/autonomous/start", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleAutonomousStart))))
	mux.Handle("POST /v1/sessions/{id}/autonomous/stop", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleAutonomousStop))))
	mux.Handle("POST /v1/jobs/lease", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleLeaseJobs))))
	mux.Handle("GET /v1/sessions/{id}/autonomous/status", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleAutonomousStatus))))
	// Budget endpoints
	mux.Handle("GET /v1/runs/{id}/budget", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetBudget))))
	mux.Handle("POST /v1/runs/{id}/budget/reserve", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleReserveBudget))))
	mux.Handle("POST /v1/runs/{id}/budget/commit", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleCommitSpend))))
	mux.Handle("POST /v1/runs/{id}/budget/update", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleUpdateBudget))))
	mux.Handle("POST /v1/runs/{id}/budget/projection", s.requireAuth(s.withRateLimit(http.HandlerFunc(s.handleGetBudgetProjection))))
	return s.withObservability(mux)
}

func (s *Server) initAdaptiveEngine() {
	cfg := adaptive.DefaultEngineConfig()

	// Platform-aware optimization
	platform := model.DetectPlatform()
	if platform.TotalRAM < 4096 {
		cfg.LowMemoryMB = 512
	}

	factory := model.NewFactory(model.FactoryConfig{
		Mode:     "auto",
		Platform: platform,
	})

	registry, err := factory.CreateRegistry(context.Background())
	if err != nil {
		// Fallback to minimal registry if creation fails
		registry = model.NewAdapterRegistry()
		_ = registry.Register(model.NewSmallModeAdapter(model.SmallModeConfig{EnableTemplating: true}))
		registry.SetDefault("small-mode")
	}

	router := factory.CreateRouter(registry)
	manager := model.NewManager(registry, router, model.FactoryConfig{
		Mode:     "auto",
		Platform: platform,
	})

	s.adaptiveEngine = adaptive.NewEngine(cfg, manager)
}

// Shutdown gracefully stops the server and its dependencies.
func (s *Server) Shutdown(ctx context.Context) error {
	s.handshakeMu.Lock()
	s.handshakes = nil // Clear challenges
	s.handshakeMu.Unlock()

	return s.sql.Close()
}

func (s *Server) handleMobileHandshakeChallenge(w http.ResponseWriter, r *http.Request) {
	var body struct {
		NodeID    string `json:"node_id"`
		OrgID     string `json:"org_id"`
		PublicKey string `json:"public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if strings.TrimSpace(body.NodeID) == "" || strings.TrimSpace(body.OrgID) == "" || strings.TrimSpace(body.PublicKey) == "" {
		writeError(w, 400, "node_id, org_id, public_key required")
		return
	}
	challenge := s.randomID("challenge")
	s.handshakeMu.Lock()
	s.handshakes[challenge] = mobileHandshakeChallenge{Challenge: challenge, NodeID: body.NodeID, OrgID: body.OrgID, PubKey: body.PublicKey, IssuedAt: time.Now().UTC()}
	s.handshakeMu.Unlock()
	writeJSON(w, 200, map[string]string{"challenge": challenge})
}

func (s *Server) handleMobileHandshakeComplete(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Challenge string `json:"challenge"`
		Signature string `json:"signature"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	s.handshakeMu.Lock()
	entry, ok := s.handshakes[body.Challenge]
	if ok {
		delete(s.handshakes, body.Challenge)
	}
	s.handshakeMu.Unlock()
	if !ok {
		writeError(w, 404, "challenge not found")
		return
	}
	if time.Since(entry.IssuedAt) > 5*time.Minute {
		writeError(w, 400, "challenge expired")
		return
	}
	pk, err := base64.StdEncoding.DecodeString(entry.PubKey)
	if err != nil || len(pk) != ed25519.PublicKeySize {
		writeError(w, 400, "invalid public key")
		return
	}
	sig, err := base64.StdEncoding.DecodeString(body.Signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		writeError(w, 400, "invalid signature")
		return
	}
	if !ed25519.Verify(ed25519.PublicKey(pk), []byte(entry.Challenge), sig) {
		writeError(w, 403, "invalid signature")
		return
	}
	sessionToken := s.randomID("mobile")
	writeJSON(w, 200, map[string]any{"session_token": sessionToken, "expires_in_seconds": 3600, "node_id": entry.NodeID, "org_id": entry.OrgID})
}

func redactValue(key string, value any) any {
	lower := strings.ToLower(key)
	if strings.Contains(lower, "secret") || strings.Contains(lower, "token") || strings.Contains(lower, "key") || strings.Contains(lower, "password") {
		return "[REDACTED]"
	}
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for k, v := range typed {
			out[k] = redactValue(k, v)
		}
		return out
	case []any:
		out := make([]any, len(typed))
		for i, item := range typed {
			out[i] = redactValue(key, item)
		}
		return out
	default:
		return value
	}
}

func redactPayload(in []byte) map[string]any {
	var decoded map[string]any
	if err := json.Unmarshal(in, &decoded); err != nil {
		return map[string]any{"redacted": true}
	}
	out := make(map[string]any, len(decoded))
	for k, v := range decoded {
		out[k] = redactValue(k, v)
	}
	return out
}

func (s *Server) handleMobilePolicyPreflight(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	writeJSON(w, 200, map[string]any{"allowed": true, "required_gate": false, "missing_capabilities": []string{}, "capabilities": body.Capabilities})
}

func (s *Server) handleMobileRunView(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), runID, 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	view := make([]map[string]any, 0, len(events))
	for _, evt := range events {
		view = append(view, map[string]any{"id": evt.ID, "type": evt.Type, "payload": redactPayload(evt.Payload), "created_at": evt.CreatedAt})
	}
	writeJSON(w, 200, map[string]any{"run_id": runID, "timeline": view})
}

func (s *Server) handleCreateShareToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RunID string `json:"run_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.RunID) == "" {
		writeError(w, 400, "run_id required")
		return
	}
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), body.RunID, 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	timeline := make([]map[string]any, 0, len(events))
	for _, evt := range events {
		timeline = append(timeline, map[string]any{"id": evt.ID, "type": evt.Type, "payload": redactPayload(evt.Payload), "created_at": evt.CreatedAt})
	}
	token := s.randomID("share")
	s.shareMu.Lock()
	s.shareViews[token] = map[string]any{"run_id": body.RunID, "timeline": timeline}
	s.shareMu.Unlock()
	writeJSON(w, 201, map[string]string{"token": token})
}

func (s *Server) handleFetchSharedRun(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	s.shareMu.RLock()
	view, ok := s.shareViews[token]
	s.shareMu.RUnlock()
	if !ok {
		writeError(w, 404, "share token not found")
		return
	}
	writeJSON(w, 200, view)
}

func (s *Server) withObservability(next http.Handler) http.Handler {
	const maxBodySize = 10 * 1024 * 1024 // 10 MiB request body limit
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		correlationID := strings.TrimSpace(r.Header.Get("X-Correlation-ID"))
		if correlationID == "" {
			correlationID = s.requestID(r)
		}
		w.Header().Set("X-Correlation-ID", correlationID)
		// Limit request body size to prevent DoS via oversized payloads
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
		}
		ctx := context.WithValue(r.Context(), ctxKey("correlation_id"), correlationID)
		next.ServeHTTP(w, r.WithContext(ctx))
		s.metrics.observeRequest(r.Method+" "+r.URL.Path, time.Since(started))
	})
}

func (s *Server) observeEvent(_ string, evt jobs.Event) {
	if s.gamification != nil {
		s.gamification.ApplyEvent(evt.Type, evt.CreatedAt)
		if err := s.gamification.Save(); err != nil {
			fmt.Fprintf(os.Stderr, "gamification save failed: %v\n", err)
		}
	}
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
	if t == PlanPro {
		return 3
	}
	if t == PlanEnterprise {
		return 6
	}
	return 1
}
func maxConcurrentAgents(t PlanTier) int {
	if t == PlanPro {
		return 8
	}
	if t == PlanEnterprise {
		return 32
	}
	return 2
}
func hostedAllowed(t PlanTier) bool { return t == PlanPro || t == PlanEnterprise }

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
func tenantIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(tenantKey).(string); ok && v != "" {
		return v
	}
	return tenant.DefaultTenantID
}

func (s *Server) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	s.setSession(w, r.Context(), "dev-user", "dev-user")
	writeJSON(w, 200, map[string]string{"tenant_id": "dev-user"})
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
		PlanTier     string   `json:"plan_tier"`
		PackCID      string   `json:"pack_cid"`
	}
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, 400, "invalid json")
			return
		}
	}
	tenant := tenantIDFrom(r.Context())
	run, err := s.store.CreateRun(r.Context(), tenant, body.PackCID, body.Capabilities)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	tier := parseTier(body.PlanTier)
	s.metaMu.Lock()
	s.runMeta[run.ID] = runMeta{Tier: tier, Spawn: SpawnContext{Depth: 0, MaxDepth: maxSpawnDepth(tier), MaxChildren: maxConcurrentAgents(tier), CapabilitySubset: body.Capabilities}}
	s.metaMu.Unlock()
	s.runsCreated.Add(1)
	_ = s.queue.Enqueue(r.Context(), jobs.QueueJob{ID: s.randomID("job"), TenantID: tenant, RunID: run.ID, Type: jobs.JobCapsuleCheckpoint, PayloadJSON: string(mustJSON(map[string]any{"run_id": run.ID, "event": "run_created"})), IdempotencyKey: run.ID + ":created", Priority: 50})
	writeJSON(w, 201, map[string]any{"run_id": run.ID, "tier": tier})
}

func (s *Server) handleInternalTrigger(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	var body struct {
		TenantID string         `json:"tenant_id"`
		Source   string         `json:"source"`
		Type     string         `json:"type"`
		Payload  map[string]any `json:"payload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.TenantID) == "" || strings.TrimSpace(body.Type) == "" {
		writeError(w, http.StatusBadRequest, "tenant_id and type required")
		return
	}
	run, err := s.store.CreateRun(r.Context(), body.TenantID, "", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	payload := mustJSON(map[string]any{"source": body.Source, "type": body.Type, "payload": body.Payload})
	_ = s.store.PublishEvent(r.Context(), run.ID, jobs.Event{Type: "trigger.received", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	s.metrics.observeTriggerLatency(time.Since(started))
	writeJSON(w, http.StatusAccepted, map[string]any{"status": "enqueued", "run_id": run.ID})
}

func (s *Server) handleSpawnRun(w http.ResponseWriter, r *http.Request) {
	parentID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())
	parent, err := s.store.GetRun(r.Context(), tenant, parentID)
	if err != nil {
		writeError(w, 404, "parent run not found")
		return
	}
	var body struct {
		Capabilities []string `json:"capabilities"`
		PackCID      string   `json:"pack_cid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if body.PackCID == "" && parent != nil {
		body.PackCID = parent.PackCID
	}
	s.metaMu.Lock()
	meta, ok := s.runMeta[parentID]
	if !ok {
		s.metaMu.Unlock()
		writeError(w, 404, "run metadata missing")
		return
	}
	if meta.Spawn.Depth+1 > meta.Spawn.MaxDepth {
		s.metaMu.Unlock()
		writeTierError(w, "pro", "spawn depth exceeded for current plan")
		return
	}
	deny := func(reason string) {
		s.spawnDenied.Add(1)
		s.metaMu.Unlock()
		_ = s.store.PublishEvent(r.Context(), parentID, jobs.Event{Type: "spawn.denied", Payload: mustJSON(map[string]any{"parent_id": parentID, "reason": reason}), CreatedAt: time.Now().UTC()}, s.requestID(r))
		writeError(w, 403, reason)
	}
	s.spawnAttempts.Add(1)
	if meta.Children >= meta.Spawn.MaxChildren {
		deny("max children exceeded")
		return
	}
	if !supportsAll(meta.Spawn.CapabilitySubset, body.Capabilities) {
		deny("child capabilities exceed parent")
		return
	}
	meta.Children++
	s.runMeta[parentID] = meta
	s.metaMu.Unlock()
	child, err := s.store.CreateRun(r.Context(), tenant, body.PackCID, body.Capabilities)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	s.metaMu.Lock()
	s.runMeta[child.ID] = runMeta{Tier: meta.Tier, Spawn: SpawnContext{ParentID: parentID, Depth: meta.Spawn.Depth + 1, MaxDepth: meta.Spawn.MaxDepth, MaxChildren: meta.Spawn.MaxChildren}}
	s.metaMu.Unlock()
	_ = s.queue.Enqueue(r.Context(), jobs.QueueJob{ID: s.randomID("job"), TenantID: tenant, RunID: child.ID, Type: jobs.JobSpawnChild, PayloadJSON: string(mustJSON(map[string]any{"parent_id": parentID, "child_id": child.ID})), IdempotencyKey: child.ID + ":spawn", Priority: 30})
	writeJSON(w, 201, map[string]any{"run_id": child.ID})
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
	tenant, runID := tenantIDFrom(r.Context()), r.PathValue("id")
	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
		NodeID               string         `json:"node_id"`     // New: for reputation & BFT
		StepIndex            int            `json:"step_index"`  // New: for BFT step tracking
		IsZkProof            bool           `json:"is_zk_proof"` // New: indicates ZK verification
		ZkHash               string         `json:"zk_hash"`     // New: ZK content hash
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	// Economic Moat: Check budget before proceeding
	// For demo, we estimate tool cost at $0.05 per call
	estCost := 0.05
	if err := s.store.CheckBudget(r.Context(), tenant, runID, estCost); err != nil {
		writeError(w, http.StatusPaymentRequired, err.Error())
		return
	}

	_ = s.queue.Enqueue(r.Context(), jobs.QueueJob{ID: s.randomID("job"), TenantID: tenant, RunID: runID, Type: jobs.JobToolCall, PayloadJSON: string(mustJSON(body)), IdempotencyKey: runID + ":tool:" + body.ToolName + ":" + hashID(fmt.Sprint(body.Result)), Priority: 40})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result.accepted", Payload: mustJSON(map[string]any{"tool": body.ToolName, "node_id": body.NodeID}), CreatedAt: time.Now().UTC()}, s.requestID(r))

	// BFT Consensus: Check if this run requires multi-node agreement
	// For demo, we assume any tool result with StepIndex > 0 might need consensus
	if body.StepIndex > 0 {
		reached, winner, err := s.consensus.ReceiveResult(runID, body.ToolName, body.StepIndex, body.NodeID, 2, body.Result)
		if err != nil {
			writeError(w, 500, "consensus failure")
			return
		}
		if !reached {
			writeJSON(w, 202, map[string]string{"status": "waiting_for_consensus"})
			return
		}
		// Overwrite body.Result with the consensus winner
		body.Result = winner
	}

	// Record the actual spend
	_ = s.store.RecordSpend(r.Context(), tenant, runID, estCost)

	s.toolCalls.Add(1)
	payload := mustJSON(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleGateDecision(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	if err := s.store.ResolveGate(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), r.PathValue("gate_id"), jobs.GateDecision("approve_once")); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	s.metrics.observeApprovalLatency(time.Since(started))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleRegisterNode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID, Type, Status, PublicKeyRef, SpecVersion, RegistrySnapshotHash string
		Capabilities                                                      []string
		LatencyMS, LoadScore                                              int
		Tags                                                              []string
		SupportedModes                                                    []string
		ContextShards                                                     []string
		TPMPubKey                                                         string
		HardwareFingerprint                                               string
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if body.ID == "" || body.Type == "" {
		writeError(w, 400, "id and type are required")
		return
	}
	tenant := tenantIDFrom(r.Context())
	if body.Type == "hosted" && !hostedAllowed(PlanPro) {
		_ = tenant
	}
	now := time.Now().UTC()
	err := s.sql.UpsertNode(r.Context(), storage.NodeRecord{ID: body.ID, TenantID: tenant, Type: body.Type, CapabilitiesJSON: string(mustJSON(body.Capabilities)), Status: body.Status, LastHeartbeatAt: now, LatencyMS: body.LatencyMS, LoadScore: body.LoadScore, TagsJSON: string(mustJSON(body.Tags)), TPMPubKeyJSON: body.TPMPubKey, HardwareFingerprint: body.HardwareFingerprint, CreatedAt: now, UpdatedAt: now})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	identity := federation.BuildIdentity(body.ID, body.PublicKeyRef, body.Capabilities, body.RegistrySnapshotHash, body.SupportedModes)
	node := s.federationStatusNode(body.ID)
	node.SpecVersion = identity.SpecVersion
	node.RegistrySnapshotHash = identity.RegistrySnapshotHash

	// Store context shards in memory registry
	s.registry.mu.Lock()
	if info, ok := s.registry.nodes[body.ID]; ok {
		info.contextShards = body.ContextShards
		info.HardwareFingerprint = body.HardwareFingerprint
		if body.TPMPubKey != "" {
			// In a real TEE implementation, we would verify the PEM/DER here
			info.TPMPubKey = body.TPMPubKey
		}
		s.registry.nodes[body.ID] = info
	}
	s.registry.mu.Unlock()

	s.federationUpsert(node)
	writeJSON(w, 201, map[string]string{"status": "registered"})
}

func (s *Server) handleNodeHeartbeat(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID                   string `json:"id"`
		Status               string `json:"status"`
		LatencyMS, LoadScore int
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	nodes, err := s.sql.ListNodes(r.Context(), tenantIDFrom(r.Context()))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	for _, n := range nodes {
		if n.ID == body.ID {
			n.LastHeartbeatAt = time.Now().UTC()
			n.Status = body.Status
			n.LatencyMS = body.LatencyMS
			n.LoadScore = body.LoadScore
			n.UpdatedAt = time.Now().UTC()
			if err := s.sql.UpsertNode(r.Context(), n); err != nil {
				writeError(w, 500, err.Error())
				return
			}
			s.federation.RecordDelegation(body.ID, "", "", true, "heartbeat", body.LatencyMS, false)
			_ = s.federation.Save()
			writeJSON(w, 200, map[string]string{"status": "ok"})
			return
		}
	}
	writeError(w, 404, "node not found")
}

func (s *Server) federationStatusNode(nodeID string) federation.NodeStats {
	if s.federation == nil {
		return federation.NodeStats{NodeID: nodeID, Snapshot: federation.ReputationSnapshot{DelegationsFailedByReason: map[string]int{}}}
	}
	return s.federation.GetNode(nodeID)
}

func (s *Server) federationUpsert(node federation.NodeStats) {
	if s.federation == nil {
		return
	}
	s.federation.UpsertNode(node)
	_ = s.federation.Save()
}

func (s *Server) handleRunEvents(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	after := int64(0)
	if lastID := strings.TrimSpace(r.Header.Get("Last-Event-ID")); lastID != "" {
		if parsed, err := strconv.ParseInt(lastID, 10, 64); err == nil && parsed > after {
			after = parsed
		}
	}
	if rawAfter := strings.TrimSpace(r.URL.Query().Get("after")); rawAfter != "" {
		parsed, err := strconv.ParseInt(rawAfter, 10, 64)
		if err != nil || parsed < 0 {
			writeError(w, http.StatusBadRequest, "invalid after")
			return
		}
		after = parsed
	}
	if acceptsSSE(r) {
		s.streamRunEvents(w, r, runID, after)
		return
	}
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), runID, after)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"events": events})
}

func (s *Server) handleListNodes(w http.ResponseWriter, r *http.Request) {
	nodes, err := s.sql.ListNodes(r.Context(), tenantIDFrom(r.Context()))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"nodes": nodes})
}
func (s *Server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = w.Write([]byte(fmt.Sprintf("runs_created_total %d\n", s.runsCreated.Load())))
	_, _ = w.Write([]byte(fmt.Sprintf("spawn_attempts_total %d\n", s.spawnAttempts.Load())))
	_, _ = w.Write([]byte(fmt.Sprintf("spawn_denied_total %d\n", s.spawnDenied.Load())))
	_, _ = w.Write([]byte(fmt.Sprintf("tool_calls_total{decision=\"allowed\"} %d\n", s.toolCalls.Load())))
}

func (s *Server) handlePromMetrics(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("RUNNER_METRICS_ENABLED") != "1" {
		writeError(w, http.StatusNotFound, "metrics disabled")
		return
	}
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = w.Write([]byte(s.metrics.prometheus()))
}

func acceptsSSE(r *http.Request) bool {
	return strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/event-stream")
}

func shouldCompressSSE(r *http.Request) bool {
	return strings.Contains(strings.ToLower(r.Header.Get("Accept-Encoding")), "gzip")
}

func (s *Server) streamRunEvents(w http.ResponseWriter, r *http.Request, runID string, after int64) {
	history, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), runID, after)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	queue := make(chan jobs.Event, 128)
	flushTicker := time.NewTicker(200 * time.Millisecond)
	defer flushTicker.Stop()

	s.metrics.setSSEQueueDepth(runID, 0)
	defer s.metrics.setSSEQueueDepth(runID, 0)

	sub, cancel := s.store.Subscribe(runID)
	defer cancel()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	var writer io.Writer = w
	if shouldCompressSSE(r) {
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		writer = gz
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	for _, evt := range history {
		queue <- evt
	}

	go func() {
		for {
			select {
			case <-r.Context().Done():
				return
			case evt := <-sub:
				select {
				case queue <- evt:
				default:
					if isLowPriorityEvent(evt.Type) {
						s.metrics.incSSEDropped(runID)
						continue
					}
					<-queue
					queue <- evt
				}
				s.metrics.setSSEQueueDepth(runID, len(queue))
			}
		}
	}()

	batch := make([]jobs.Event, 0, 32)
	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-queue:
			batch = append(batch, evt)
			if len(batch) >= 24 {
				if !writeSSEBatch(writer, batch) {
					return
				}
				flusher.Flush()
				batch = batch[:0]
			}
		case <-flushTicker.C:
			if len(batch) == 0 {
				continue
			}
			if !writeSSEBatch(writer, batch) {
				return
			}
			flusher.Flush()
			batch = batch[:0]
		}
	}
}

func writeSSEBatch(w io.Writer, batch []jobs.Event) bool {
	if len(batch) == 1 {
		payload, _ := json.Marshal(map[string]any{"eventId": batch[0].ID, "type": batch[0].Type, "payload": json.RawMessage(batch[0].Payload), "timestamp": batch[0].CreatedAt.Format(time.RFC3339Nano)})
		_, err := fmt.Fprintf(w, "id: %d\ndata: %s\n\n", batch[0].ID, payload)
		return err == nil
	}
	items := make([]map[string]any, 0, len(batch))
	for _, evt := range batch {
		items = append(items, map[string]any{"eventId": evt.ID, "type": evt.Type, "payload": json.RawMessage(evt.Payload), "timestamp": evt.CreatedAt.Format(time.RFC3339Nano)})
	}
	lastID := batch[len(batch)-1].ID
	payload, _ := json.Marshal(map[string]any{"type": "batch", "items": items})
	_, err := fmt.Fprintf(w, "id: %d\ndata: %s\n\n", lastID, payload)
	return err == nil
}

func isLowPriorityEvent(eventType string) bool {
	return strings.HasPrefix(eventType, "task.") || strings.HasPrefix(eventType, "telemetry.") || strings.HasPrefix(eventType, "progress")
}

func (s *Server) requestID(r *http.Request) string {
	if rid := strings.TrimSpace(r.Header.Get("X-Request-ID")); rid != "" {
		return rid
	}
	return fmt.Sprintf("req-%d", s.requestCounter.Add(1))
}
func (s *Server) randomID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}
func hashID(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:8]) }
func writeTierError(w http.ResponseWriter, required, reason string) {
	writeJSON(w, 403, map[string]string{"error": "tier_required", "tier_required": required, "next_step": "upgrade plan to unlock this orchestration limit", "reason": reason})
}
func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}
func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
func (s *Server) handleLeaseJobs(w http.ResponseWriter, r *http.Request) {
	var body struct {
		NodeID string `json:"node_id"`
		Limit  int    `json:"limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if body.Limit <= 0 {
		body.Limit = 10
	}

	token, jobs, err := s.queue.Lease(r.Context(), body.Limit, 30*time.Second)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// ZK Execution Envelopes: Encrypt sensitive payloads for nodes
	// In this demo, we use a global simulation key if node key isn't registered
	for i, j := range jobs {
		if j.Type == "ToolCall" {
			// Find node public key
			node, ok := s.registry.GetNode(body.NodeID)
			if ok && node.PubKey != nil {
				// Seal the payload (Sensitive ZK Envelope)
				if pub, isRsa := node.PubKey.(*rsa.PublicKey); isRsa {
					env, err := federation.Seal([]byte(j.PayloadJSON), pub, body.NodeID)
					if err == nil {
						j.PayloadJSON = string(mustJSON(env))
						j.Type += " (ZK Encrypted)"
					}
				}
			}
		}
		jobs[i] = j
	}

	writeJSON(w, 200, map[string]any{"lease_token": token, "jobs": jobs})
}

func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
