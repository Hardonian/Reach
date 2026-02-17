package api

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
	version string

	store      *jobs.Store
	sql        *storage.SQLiteStore
	registry   *NodeRegistry
	metaMu     sync.RWMutex
	runMeta    map[string]runMeta
	autonomMu  sync.RWMutex
	autonomous map[string]*autoControl
	metrics    *metrics

	requestCounter atomic.Uint64
	runsCreated    atomic.Uint64
	spawnAttempts  atomic.Uint64
	spawnDenied    atomic.Uint64
	toolCalls      atomic.Uint64
}

func NewServer(db *storage.SQLiteStore, version string) *Server {
	if strings.TrimSpace(version) == "" {
		version = "dev"
	}
	return &Server{version: version, store: jobs.NewStore(db), queue: jobs.NewDurableQueue(db), sql: db, runMeta: map[string]runMeta{}}
	return &Server{
		version:    version,
		store:      jobs.NewStore(db),
		sql:        db,
		registry:   NewNodeRegistry(),
		runMeta:    map[string]runMeta{},
		autonomous: map[string]*autoControl{},
		metrics:    newMetrics(),
	}
	return &Server{version: version, store: jobs.NewStore(db), sql: db, registry: NewNodeRegistry(), runMeta: map[string]runMeta{}, autonomous: map[string]*autoControl{}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("POST /auth/dev-login", s.handleDevLogin)
	mux.HandleFunc("POST /internal/v1/triggers", s.handleInternalTrigger)
	mux.Handle("POST /v1/runs", s.requireAuth(http.HandlerFunc(s.handleCreateRun)))
	mux.Handle("POST /v1/runs/{id}/spawn", s.requireAuth(http.HandlerFunc(s.handleSpawnRun)))
	mux.Handle("POST /v1/runs/{id}/tool-result", s.requireAuth(http.HandlerFunc(s.handleToolResult)))
	mux.Handle("GET /v1/runs/{id}/events", s.requireAuth(http.HandlerFunc(s.handleRunEvents)))
	mux.Handle("POST /v1/runs/{id}/export", s.requireAuth(http.HandlerFunc(s.handleExport)))
	mux.Handle("POST /v1/runs/import", s.requireAuth(http.HandlerFunc(s.handleImport)))
	mux.Handle("GET /v1/runs/{id}/audit", s.requireAuth(http.HandlerFunc(s.handleGetAudit)))
	mux.Handle("POST /v1/runs/{id}/gates/{gate_id}", s.requireAuth(http.HandlerFunc(s.handleGateDecision)))
	mux.Handle("GET /v1/plugins", s.requireAuth(http.HandlerFunc(s.handleListPlugins)))
	mux.HandleFunc("GET /metrics", s.handlePromMetrics)
	mux.Handle("GET /v1/metrics", s.requireAuth(http.HandlerFunc(s.handleMetrics)))
	mux.Handle("POST /v1/nodes/register", s.requireAuth(http.HandlerFunc(s.handleRegisterNode)))
	mux.Handle("POST /v1/nodes/heartbeat", s.requireAuth(http.HandlerFunc(s.handleNodeHeartbeat)))
	mux.Handle("GET /v1/nodes", s.requireAuth(http.HandlerFunc(s.handleListNodes)))
	return mux
	mux.Handle("POST /v1/sessions/{id}/autonomous/start", s.requireAuth(http.HandlerFunc(s.handleAutonomousStart)))
	mux.Handle("POST /v1/sessions/{id}/autonomous/stop", s.requireAuth(http.HandlerFunc(s.handleAutonomousStop)))
	mux.Handle("GET /v1/sessions/{id}/autonomous/status", s.requireAuth(http.HandlerFunc(s.handleAutonomousStatus)))
	return s.withObservability(mux)
}

func (s *Server) withObservability(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		correlationID := strings.TrimSpace(r.Header.Get("X-Correlation-ID"))
		if correlationID == "" {
			correlationID = s.requestID(r)
		}
		w.Header().Set("X-Correlation-ID", correlationID)
		ctx := context.WithValue(r.Context(), ctxKey("correlation_id"), correlationID)
		next.ServeHTTP(w, r.WithContext(ctx))
		s.metrics.observeRequest(r.Method+" "+r.URL.Path, time.Since(started))
	})
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
	run, err := s.store.CreateRun(r.Context(), body.TenantID, nil)
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
	deny := func(reason string) {
		s.spawnDenied.Add(1)
		s.metaMu.Unlock()
		_ = s.store.PublishEvent(r.Context(), parentID, jobs.Event{Type: "spawn.denied", Payload: mustJSON(map[string]any{"parent_id": parentID, "reason": reason}), CreatedAt: time.Now().UTC()}, s.requestID(r))
		writeError(w, 403, reason)
	}
	s.spawnAttempts.Add(1)
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
	s.toolCalls.Add(1)
	payload := mustJSON(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleGateDecision(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	if err := s.store.ResolveGate(r.Context(), r.PathValue("id"), r.PathValue("gate_id"), jobs.GateDecision("approve_once")); err != nil {
	if err := s.store.ResolveGate(r.Context(), tenantIDFrom(r.Context()), r.PathValue("id"), r.PathValue("gate_id"), jobs.GateDecision("approve_once")); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	s.metrics.observeApprovalLatency(time.Since(started))
	writeJSON(w, 200, map[string]string{"status": "ok"})
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
	writeJSON(w, 200, map[string]any{"entries": entries})
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
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
