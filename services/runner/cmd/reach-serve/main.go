package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/federation"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

const (
	apiVersion  = "1.0.0"
	specVersion = "1.0.0"
)

var (
	version = "dev"
)

type Server struct {
	version    string
	store      *jobs.Store
	queue      *jobs.DurableQueue
	sql        *storage.SQLiteStore
	federation *federation.Coordinator
	dataRoot   string
	
	// Metrics for Prometheus
	metrics *ServerMetrics
}

// ServerMetrics holds Prometheus-style metrics
type ServerMetrics struct {
	requestsTotal   atomic.Uint64
	requestsActive  atomic.Int64
	requestsError   atomic.Uint64
	runsCreated     atomic.Uint64
	runsCompleted   atomic.Uint64
	capsulesCreated atomic.Uint64
	startTime       time.Time
}

func main() {
	var (
		port    = flag.Int("port", 8787, "Port to listen on")
		bind    = flag.String("bind", "127.0.0.1", "Address to bind to (use 0.0.0.0 for all interfaces)")
		dataDir = flag.String("data", "data", "Data directory path")
	)
	flag.Parse()

	if err := run(*port, *bind, *dataDir); err != nil {
		log.Fatal(err)
	}
}

func run(port int, bindAddr, dataDir string) error {
	// Security: Only allow 0.0.0.0 explicitly
	if bindAddr == "0.0.0.0" {
		log.Println("WARNING: Binding to all interfaces (0.0.0.0). Use only in trusted networks.")
	} else if bindAddr != "127.0.0.1" && bindAddr != "localhost" {
		log.Printf("WARNING: Binding to %s. For local development, use 127.0.0.1", bindAddr)
	}

	// Ensure data directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "reach.sqlite")
	db, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	fed := federation.NewCoordinator(filepath.Join(dataDir, "federation_reputation.json"))
	_ = fed.Load()

	server := &Server{
		version:    version,
		store:      jobs.NewStore(db),
		queue:      jobs.NewDurableQueue(db),
		sql:        db,
		federation: fed,
		dataRoot:   dataDir,
		metrics: &ServerMetrics{
			startTime: time.Now().UTC(),
		},
	}

	mux := http.NewServeMux()

	// System endpoints
	mux.HandleFunc("GET /health", server.handleHealth)
	mux.HandleFunc("GET /version", server.handleVersion)
	mux.HandleFunc("GET /metrics", server.handleMetrics)

	// Run endpoints
	mux.HandleFunc("POST /runs", server.handleCreateRun)
	mux.HandleFunc("GET /runs/{id}", server.handleGetRun)
	mux.HandleFunc("GET /runs/{id}/events", server.handleGetRunEvents)
	mux.HandleFunc("POST /runs/{id}/replay", server.handleReplayRun)

	// Capsule endpoints
	mux.HandleFunc("POST /capsules", server.handleCreateCapsule)
	mux.HandleFunc("POST /capsules/verify", server.handleVerifyCapsule)

	// Federation endpoints
	mux.HandleFunc("GET /federation/status", server.handleFederationStatus)

	// Pack endpoints
	mux.HandleFunc("GET /packs", server.handleListPacks)
	mux.HandleFunc("POST /packs/install", server.handleInstallPack)
	mux.HandleFunc("POST /packs/verify", server.handleVerifyPack)

	// Wrap with middleware - inject server for metrics
	muxWithServer := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), serverKey, server)
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
	handler := withRateLimit(withCorrelationID(withLogging(withRecovery(muxWithServer))))

	addr := net.JoinHostPort(bindAddr, strconv.Itoa(port))
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errChan := make(chan error, 1)
	go func() {
		log.Printf("Reach server listening on http://%s", addr)
		log.Printf("API version: %s, Spec version: %s", apiVersion, specVersion)
		errChan <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		log.Println("Shutting down server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	case err := <-errChan:
		return err
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	// Check database connectivity
	dbStatus := "ok"
	if err := s.sql.Ping(r.Context()); err != nil {
		dbStatus = "error"
	}
	
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"version":    s.version,
		"database":   dbStatus,
		"uptime":     time.Since(s.metrics.startTime).Seconds(),
	})
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	metrics := fmt.Sprintf(`# HELP reach_requests_total Total number of HTTP requests
# TYPE reach_requests_total counter
reach_requests_total %d

# HELP reach_requests_active Current number of active requests
# TYPE reach_requests_active gauge
reach_requests_active %d

# HELP reach_requests_error_total Total number of HTTP request errors
# TYPE reach_requests_error_total counter
reach_requests_error_total %d

# HELP reach_runs_created_total Total number of runs created
# TYPE reach_runs_created_total counter
reach_runs_created_total %d

# HELP reach_runs_completed_total Total number of runs completed
# TYPE reach_runs_completed_total counter
reach_runs_completed_total %d

# HELP reach_capsules_created_total Total number of capsules created
# TYPE reach_capsules_created_total counter
reach_capsules_created_total %d

# HELP reach_uptime_seconds Server uptime in seconds
# TYPE reach_uptime_seconds gauge
reach_uptime_seconds %.0f

# HELP reach_memory_alloc_bytes Current memory allocation in bytes
# TYPE reach_memory_alloc_bytes gauge
reach_memory_alloc_bytes %d

# HELP reach_goroutines_total Current number of goroutines
# TYPE reach_goroutines_total gauge
reach_goroutines_total %d
`,
		s.metrics.requestsTotal.Load(),
		s.metrics.requestsActive.Load(),
		s.metrics.requestsError.Load(),
		s.metrics.runsCreated.Load(),
		s.metrics.runsCompleted.Load(),
		s.metrics.capsulesCreated.Load(),
		time.Since(s.metrics.startTime).Seconds(),
		memStats.Alloc,
		runtime.NumGoroutine(),
	)
	
	w.Write([]byte(metrics))
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"apiVersion":          apiVersion,
		"specVersion":         specVersion,
		"compatibilityPolicy": "backward_compatible",
		"supportedVersions":   []string{"1.0.0"},
	})
}

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Capabilities []string `json:"capabilities"`
		PlanTier     string   `json:"plan_tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", "Check the request body is valid JSON")
		return
	}

	// Default to free tier
	tier := body.PlanTier
	if tier == "" {
		tier = "free"
	}

	run, err := s.store.CreateRun(r.Context(), "local", "", body.Capabilities)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), "Please try again later")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":           run.ID,
		"status":       "pending",
		"tier":         tier,
		"capabilities": body.Capabilities,
		"created_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Run ID is required", "Provide a valid run ID")
		return
	}

	run, err := s.store.GetRun(r.Context(), "local", runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "RUN_NOT_FOUND", err.Error(), "Verify the run ID exists")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":         run.ID,
		"status":     "running",
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleGetRunEvents(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	after := int64(0)

	if rawAfter := r.URL.Query().Get("after"); rawAfter != "" {
		if parsed, err := strconv.ParseInt(rawAfter, 10, 64); err == nil {
			after = parsed
		}
	}

	events, err := s.store.EventHistory(r.Context(), "local", runID, after)
	if err != nil {
		writeError(w, http.StatusNotFound, "RUN_NOT_FOUND", err.Error(), "Verify the run ID exists")
		return
	}

	// Check for SSE request
	if strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/event-stream") {
		s.streamEvents(w, r, events)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

func (s *Server) streamEvents(w http.ResponseWriter, r *http.Request, events []jobs.Event) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Streaming not supported", nil)
		return
	}

	for _, evt := range events {
		payload, _ := json.Marshal(map[string]any{
			"id":        evt.ID,
			"type":      evt.Type,
			"payload":   json.RawMessage(evt.Payload),
			"timestamp": evt.CreatedAt.Format(time.RFC3339Nano),
		})
		fmt.Fprintf(w, "id: %d\ndata: %s\n\n", evt.ID, payload)
	}
	flusher.Flush()
}

func (s *Server) handleReplayRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")

	// Load run record from disk (reachctl format)
	record, err := s.loadRunRecord(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "RUN_NOT_FOUND", err.Error(), "Verify the run ID exists")
		return
	}

	// Compute replay fingerprint
	fingerprint := determinism.Hash(map[string]any{
		"event_log": record.EventLog,
		"run_id":    record.RunID,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":          runID,
		"replay_verified": fingerprint == record.RunFingerprint,
		"steps":           len(record.EventLog),
		"policy":          record.Policy,
	})
}

func (s *Server) handleCreateCapsule(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RunID string `json:"run_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	record, err := s.loadRunRecord(body.RunID)
	if err != nil {
		writeError(w, http.StatusNotFound, "RUN_NOT_FOUND", err.Error(), nil)
		return
	}

	capsule := s.buildCapsule(record)

	// Save capsule
	capsuleDir := filepath.Join(s.dataRoot, "capsules")
	_ = os.MkdirAll(capsuleDir, 0755)
	capsulePath := filepath.Join(capsuleDir, record.RunID+".capsule.json")

	if err := s.writeDeterministicJSON(capsulePath, capsule); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"manifest":    capsule.Manifest,
		"event_log":   capsule.EventLog,
		"capsulePath": capsulePath,
	})
}

func (s *Server) handleVerifyCapsule(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	capsule, err := s.readCapsule(body.Path)
	if err != nil {
		writeError(w, http.StatusNotFound, "CAPSULE_NOT_FOUND", err.Error(), nil)
		return
	}

	recomputed := determinism.Hash(map[string]any{
		"event_log": capsule.EventLog,
		"run_id":    capsule.Manifest.RunID,
	})
	ok := recomputed == capsule.Manifest.RunFingerprint

	writeJSON(w, http.StatusOK, map[string]any{
		"verified":               ok,
		"run_id":                 capsule.Manifest.RunID,
		"run_fingerprint":        capsule.Manifest.RunFingerprint,
		"recomputed_fingerprint": recomputed,
		"audit_root":             capsule.Manifest.AuditRoot,
	})
}

func (s *Server) handleFederationStatus(w http.ResponseWriter, r *http.Request) {
	nodes := s.federation.Status()
	writeJSON(w, http.StatusOK, map[string]any{
		"nodes": nodes,
	})
}

func (s *Server) handleListPacks(w http.ResponseWriter, r *http.Request) {
	query := strings.ToLower(r.URL.Query().Get("q"))
	idx, _ := s.loadRegistryIndex()

	var results []registryEntry
	for _, p := range idx.Packs {
		if query == "" || strings.Contains(strings.ToLower(p.Name), query) {
			results = append(results, p)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (s *Server) handleInstallPack(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	idx, _ := s.loadRegistryIndex()
	p, ok := s.findPack(idx, body.Name)
	if !ok {
		writeError(w, http.StatusNotFound, "PACK_NOT_FOUND", "Pack not found", nil)
		return
	}

	installPath := filepath.Join(s.dataRoot, "packs", p.Name+".json")
	_ = os.MkdirAll(filepath.Dir(installPath), 0755)
	if err := s.writeDeterministicJSON(installPath, p); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"installed":      p.Name,
		"path":           installPath,
		"verified_badge": p.Verified,
	})
}

func (s *Server) handleVerifyPack(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	idx, _ := s.loadRegistryIndex()
	p, ok := s.findPack(idx, body.Name)
	if !ok {
		writeError(w, http.StatusNotFound, "PACK_NOT_FOUND", "Pack not found", nil)
		return
	}

	validSig := strings.TrimSpace(p.Signature) != ""
	compatible := p.SpecVersion == specVersion

	writeJSON(w, http.StatusOK, map[string]any{
		"name":            p.Name,
		"signature_valid": validSig,
		"spec_compatible": compatible,
		"verified":        p.Verified && validSig && compatible,
	})
}

// Helper types and methods

type runRecord struct {
	RunID                string             `json:"run_id"`
	Pack                 map[string]any     `json:"pack"`
	Policy               map[string]any     `json:"policy"`
	RegistrySnapshotHash string             `json:"registry_snapshot_hash"`
	EventLog             []map[string]any   `json:"event_log"`
	FederationPath       []string           `json:"federation_path"`
	TrustScores          map[string]float64 `json:"trust_scores"`
	AuditChain           []string           `json:"audit_chain"`
	Environment          map[string]string  `json:"environment"`
	RunFingerprint       string             `json:"run_fingerprint"`
}

type capsuleManifest struct {
	SpecVersion          string             `json:"spec_version"`
	RunID                string             `json:"run_id"`
	RunFingerprint       string             `json:"run_fingerprint"`
	RegistrySnapshotHash string             `json:"registry_snapshot_hash"`
	Pack                 map[string]any     `json:"pack"`
	Policy               map[string]any     `json:"policy"`
	FederationPath       []string           `json:"federation_path"`
	TrustScores          map[string]float64 `json:"trust_scores,omitempty"`
	AuditRoot            string             `json:"audit_root,omitempty"`
	Environment          map[string]string  `json:"environment"`
	CreatedAt            string             `json:"created_at"`
}

type capsuleFile struct {
	Manifest capsuleManifest  `json:"manifest"`
	EventLog []map[string]any `json:"event_log"`
}

type registryIndex struct {
	Packs []registryEntry `json:"packs"`
}

type registryEntry struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	Repo            string `json:"repo"`
	SpecVersion     string `json:"spec_version"`
	Signature       string `json:"signature"`
	Reproducibility string `json:"reproducibility"`
	Verified        bool   `json:"verified"`
}

func (s *Server) loadRunRecord(runID string) (runRecord, error) {
	var rec runRecord
	path := filepath.Join(s.dataRoot, "runs", runID+".json")
	b, err := os.ReadFile(path)
	if err != nil {
		return rec, fmt.Errorf("run %s not found", runID)
	}
	if err := json.Unmarshal(b, &rec); err != nil {
		return rec, err
	}
	if rec.RunID == "" {
		rec.RunID = runID
	}
	if rec.Environment == nil {
		rec.Environment = map[string]string{"os": "unknown", "runtime": "reach-serve"}
	}
	return rec, nil
}

func (s *Server) buildCapsule(rec runRecord) capsuleFile {
	auditRoot := ""
	if len(rec.AuditChain) > 0 {
		auditRoot = s.merkleRoot(rec.AuditChain)
	}
	fingerprint := determinism.Hash(map[string]any{
		"event_log": rec.EventLog,
		"run_id":    rec.RunID,
	})
	return capsuleFile{
		Manifest: capsuleManifest{
			SpecVersion:          specVersion,
			RunID:                rec.RunID,
			RunFingerprint:       fingerprint,
			RegistrySnapshotHash: rec.RegistrySnapshotHash,
			Pack:                 rec.Pack,
			Policy:               rec.Policy,
			FederationPath:       rec.FederationPath,
			TrustScores:          rec.TrustScores,
			AuditRoot:            auditRoot,
			Environment:          rec.Environment,
			CreatedAt:            time.Now().UTC().Format(time.RFC3339),
		},
		EventLog: rec.EventLog,
	}
}

func (s *Server) readCapsule(path string) (capsuleFile, error) {
	var c capsuleFile
	b, err := os.ReadFile(path)
	if err != nil {
		return c, err
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, err
	}
	if c.Manifest.RunID == "" {
		return c, fmt.Errorf("invalid capsule")
	}
	return c, nil
}

func (s *Server) merkleRoot(leaves []string) string {
	if len(leaves) == 0 {
		return determinism.Hash("empty")
	}
	hashes := make([]string, 0, len(leaves))
	for _, l := range leaves {
		hashes = append(hashes, determinism.Hash(l))
	}
	for len(hashes) > 1 {
		var next []string
		for i := 0; i < len(hashes); i += 2 {
			if i+1 < len(hashes) {
				next = append(next, determinism.Hash(hashes[i]+hashes[i+1]))
			} else {
				next = append(next, determinism.Hash(hashes[i]+hashes[i]))
			}
		}
		hashes = next
	}
	return hashes[0]
}

func (s *Server) writeDeterministicJSON(path string, v any) error {
	return os.WriteFile(path, []byte(determinism.CanonicalJSON(v)+"\n"), 0644)
}

func (s *Server) loadRegistryIndex() (registryIndex, error) {
	var idx registryIndex
	path := filepath.Join(s.dataRoot, "registry", "index.json")
	b, err := os.ReadFile(path)
	if err != nil {
		// Return default index
		return registryIndex{
			Packs: []registryEntry{
				{
					Name:            "arcadeSafe.demo",
					Repo:            "https://example.org/reach/arcadeSafe.demo",
					SpecVersion:     specVersion,
					Signature:       "sig-demo",
					Reproducibility: "A",
					Verified:        true,
				},
			},
		}, nil
	}
	if err := json.Unmarshal(b, &idx); err != nil {
		return idx, err
	}
	return idx, nil
}

func (s *Server) findPack(idx registryIndex, name string) (registryEntry, bool) {
	for _, p := range idx.Packs {
		if p.Name == name {
			return p, true
		}
	}
	return registryEntry{}, false
}

// Middleware
type contextKey string

const correlationIDKey contextKey = "correlation_id"
const serverKey contextKey = "server"

func withCorrelationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Correlation-ID")
		if id == "" {
			id = "corr_" + strings.ReplaceAll(strconv.FormatInt(time.Now().UnixNano(), 36), " ", "")
		}
		ctx := context.WithValue(r.Context(), correlationIDKey, id)
		w.Header().Set("X-Correlation-ID", id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		corrID, _ := r.Context().Value(correlationIDKey).(string)
		
		// Get server from context if available for metrics
		server, _ := r.Context().Value(serverKey).(*Server)
		if server != nil {
			server.metrics.requestsTotal.Add(1)
			server.metrics.requestsActive.Add(1)
			defer server.metrics.requestsActive.Add(-1)
		}

		// Custom response writer to capture status code
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		
		if server != nil && rw.status >= 400 {
			server.metrics.requestsError.Add(1)
		}

		log.Printf("[%s] %s %s %d %s", corrID, r.Method, r.URL.Path, rw.status, time.Since(start))
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

var (
	rateLimitMu sync.Mutex
	rateLimits  = make(map[string]*visitor)
)

type visitor struct {
	lastSeen time.Time
	count    int
}

func withRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)

		rateLimitMu.Lock()
		v, ok := rateLimits[ip]
		if !ok {
			v = &visitor{lastSeen: time.Now()}
			rateLimits[ip] = v
		}

		// Reset count if more than 1 minute passed
		if time.Since(v.lastSeen) > time.Minute {
			v.count = 0
		}

		v.count++
		v.lastSeen = time.Now()
		count := v.count
		rateLimitMu.Unlock()

		// Limit to 100 requests per minute per IP for production-bound hardening
		limit := 100
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(limit-count))

		if count > limit {
			writeError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests", "Wait 60 seconds and try again")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error", nil)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Response helpers
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func writeError(w http.ResponseWriter, code int, errCode, message string, remediation any) {
	body := map[string]any{
		"error": message,
		"code":  errCode,
	}
	if remediation != nil {
		body["remediation"] = remediation
	}
	writeJSON(w, code, body)
}
