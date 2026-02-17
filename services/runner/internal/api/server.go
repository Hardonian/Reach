package api

import (
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

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

type ctxKey string

const tenantKey ctxKey = "tenant"

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
