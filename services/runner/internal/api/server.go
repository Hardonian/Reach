package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

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
	ParentID    string `json:"parent_id"`
	Depth       int    `json:"depth"`
	MaxDepth    int    `json:"max_depth"`
	MaxChildren int    `json:"max_children"`
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
	metaMu         sync.RWMutex
	runMeta        map[string]runMeta
	requestCounter atomic.Uint64
	runsCreated    atomic.Uint64
}

func NewServer(db *storage.SQLiteStore, version string) *Server {
	if strings.TrimSpace(version) == "" {
		version = "dev"
	}
	return &Server{version: version, store: jobs.NewStore(db), queue: jobs.NewDurableQueue(db), sql: db, runMeta: map[string]runMeta{}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.Handle("POST /v1/runs", s.requireAuth(http.HandlerFunc(s.handleCreateRun)))
	mux.Handle("POST /v1/runs/{id}/spawn", s.requireAuth(http.HandlerFunc(s.handleSpawnRun)))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(http.HandlerFunc(s.handleToolResult)))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleRunEvents)))
	mux.Handle("GET /v1/metrics", s.requireAuth(http.HandlerFunc(s.handleMetrics)))
	mux.Handle("POST /v1/nodes/register", s.requireAuth(http.HandlerFunc(s.handleRegisterNode)))
	mux.Handle("POST /v1/nodes/heartbeat", s.requireAuth(http.HandlerFunc(s.handleNodeHeartbeat)))
	mux.Handle("GET /v1/nodes", s.requireAuth(http.HandlerFunc(s.handleListNodes)))
	return mux
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
func tenantIDFrom(ctx context.Context) string { v, _ := ctx.Value(tenantKey).(string); return v }

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
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	tenant := tenantIDFrom(r.Context())
	run, err := s.store.CreateRun(r.Context(), tenant, body.Capabilities)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	tier := parseTier(body.PlanTier)
	s.metaMu.Lock()
	s.runMeta[run.ID] = runMeta{Tier: tier, Spawn: SpawnContext{Depth: 0, MaxDepth: maxSpawnDepth(tier), MaxChildren: maxConcurrentAgents(tier)}}
	s.metaMu.Unlock()
	s.runsCreated.Add(1)
	_ = s.queue.Enqueue(r.Context(), jobs.QueueJob{ID: s.randomID("job"), TenantID: tenant, RunID: run.ID, Type: jobs.JobCapsuleCheckpoint, PayloadJSON: string(mustJSON(map[string]any{"run_id": run.ID, "event": "run_created"})), IdempotencyKey: run.ID + ":created", Priority: 50})
	writeJSON(w, 201, map[string]any{"run_id": run.ID, "tier": tier})
}

func (s *Server) handleSpawnRun(w http.ResponseWriter, r *http.Request) {
	parentID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())
	if _, err := s.store.GetRun(r.Context(), tenant, parentID); err != nil {
		writeError(w, 404, err.Error())
		return
	}
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
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
	if meta.Children >= meta.Spawn.MaxChildren {
		s.metaMu.Unlock()
		writeError(w, 429, "spawn budget exhausted")
		return
	}
	meta.Children++
	s.runMeta[parentID] = meta
	s.metaMu.Unlock()
	child, err := s.store.CreateRun(r.Context(), tenant, body.Capabilities)
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
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if err := s.store.CheckCapabilities(r.Context(), tenant, runID, body.RequiredCapabilities); err != nil {
		writeError(w, 403, err.Error())
		return
	}
	_ = s.queue.Enqueue(r.Context(), jobs.QueueJob{ID: s.randomID("job"), TenantID: tenant, RunID: runID, Type: jobs.JobToolCall, PayloadJSON: string(mustJSON(body)), IdempotencyKey: runID + ":tool:" + body.ToolName + ":" + hashID(fmt.Sprint(body.Result)), Priority: 40})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result.accepted", Payload: mustJSON(map[string]any{"tool": body.ToolName}), CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, 200, map[string]string{"status": "queued"})
}

func (s *Server) handleRunEvents(w http.ResponseWriter, r *http.Request) {
	events, err := s.store.EventHistory(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), 0)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"events": events})
}

func (s *Server) handleRegisterNode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID, Type, Status     string
		Capabilities         []string
		LatencyMS, LoadScore int
		Tags                 []string
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
	err := s.sql.UpsertNode(r.Context(), storage.NodeRecord{ID: body.ID, TenantID: tenant, Type: body.Type, CapabilitiesJSON: string(mustJSON(body.Capabilities)), Status: body.Status, LastHeartbeatAt: now, LatencyMS: body.LatencyMS, LoadScore: body.LoadScore, TagsJSON: string(mustJSON(body.Tags)), CreatedAt: now, UpdatedAt: now})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
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
			writeJSON(w, 200, map[string]string{"status": "ok"})
			return
		}
	}
	writeError(w, 404, "node not found")
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
	writeJSON(w, 200, map[string]uint64{"runs_created": s.runsCreated.Load()})
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
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
