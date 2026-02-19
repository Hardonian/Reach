package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reach/services/runner/internal/adaptive"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	run, err := s.store.GetRun(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	events, err := s.sql.ListEvents(r.Context(), tenant, runID, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list events: "+err.Error())
		return
	}

	audit, err := s.sql.ListAudit(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit: "+err.Error())
		return
	}

	bundle := map[string]any{
		"run":    run,
		"events": events,
		"audit":  audit,
		"export_info": map[string]any{
			"version":     s.version,
			"exported_at": time.Now().UTC(),
		},
	}

	writeJSON(w, http.StatusOK, bundle)
}

func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	var bundle struct {
		Run    storage.RunRecord     `json:"run"`
		Events []storage.EventRecord `json:"events"`
		Audit  []storage.AuditRecord `json:"audit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&bundle); err != nil {
		writeError(w, http.StatusBadRequest, "invalid bundle json")
		return
	}

	tenant := tenantIDFrom(r.Context())
	if bundle.Run.TenantID != tenant {
		writeError(w, http.StatusForbidden, "tenant mismatch")
		return
	}

	// Transactions are handled within the store/sql methods but here we just do bulk insert
	if err := s.sql.CreateRun(r.Context(), bundle.Run); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to import run metadata: "+err.Error())
		return
	}

	for _, e := range bundle.Events {
		if _, err := s.sql.AppendEvent(r.Context(), e); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to import event: "+err.Error())
			return
		}
	}

	for _, a := range bundle.Audit {
		if err := s.sql.AppendAudit(r.Context(), a); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to import audit log: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "imported", "run_id": bundle.Run.ID})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	run, err := s.store.GetRun(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	// Decision Ledger: Combine run data with strategy trace
	audit := map[string]any{
		"run_id":       run.ID,
		"status":       run.Status,
		"created_at":   run.CreatedAt,
		"capabilities": run.Capabilities,
	}

	// If it's a critical run, we include more "Visual Proof" data
	if run.IsCritical {
		audit["proof_fingerprint"] = run.Fingerprint
		audit["verification_status"] = "verified"
	}

	writeJSON(w, http.StatusOK, audit)
}

func (s *Server) handleGetStrategy(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	run, err := s.store.GetRun(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	constraints := adaptive.TaskConstraints{
		RequireComplexReasoning: run.IsCritical,
		Critical:                run.IsCritical,
	}

	// Self-Healing: If run is hardened (due to drift), force Deterministic Strict mode
	if s.store.IsHardened(run.ID) {
		constraints.Mode = adaptive.OptDeterministic
	}

	strategy, err := s.adaptiveEngine.DetermineStrategy(constraints)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to determine execution strategy: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":      run.ID,
		"strategy":    strategy,
		"constraints": constraints,
	})
}

func (s *Server) handleSimulateOptions(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	run, err := s.store.GetRun(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	constraints := adaptive.TaskConstraints{
		RequireComplexReasoning: true, // Default simulation scenario
	}
	if run.IsCritical {
		constraints.Critical = true
	}

	options := s.adaptiveEngine.SimulateOptions(constraints)

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":       runID,
		"constraints":  constraints,
		"alternatives": options,
	})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, r *http.Request) {
	dataRoot := strings.TrimSpace(os.Getenv("REACH_DATA_DIR"))
	if dataRoot == "" {
		dataRoot = "data"
	}
	pluginDir := filepath.Join(dataRoot, "plugins")

	files, err := os.ReadDir(pluginDir)
	if err != nil {
		// Not an error if dir doesn't exist, just empty list
		writeJSON(w, http.StatusOK, map[string][]string{"plugins": {}})
		return
	}

	var plugins []string
	for _, f := range files {
		if f.IsDir() {
			plugins = append(plugins, f.Name())
		}
	}

	writeJSON(w, http.StatusOK, map[string][]string{"plugins": plugins})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]any{
		"status":  "ok",
		"version": s.version,
		"time":    time.Now().UTC(),
	}

	if err := s.sql.Ping(r.Context()); err != nil {
		health["status"] = "degraded"
		health["database"] = "unreachable: " + err.Error()
		writeJSON(w, http.StatusServiceUnavailable, health)
		return
	}

	health["database"] = "healthy"
	writeJSON(w, http.StatusOK, health)
}

func (s *Server) handleAutonomousStart(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	// Ensure run exists and belongs to tenant
	if _, err := s.store.GetRun(r.Context(), tenant, runID); err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	var body struct {
		Goal         string `json:"goal"`
		MaxIter      int    `json:"max_iterations"`
		MaxRuntime   int    `json:"max_runtime"`
		MaxToolCalls int    `json:"max_tool_calls"`
		BurstMin     int    `json:"burst_min_seconds"`
		BurstMax     int    `json:"burst_max_seconds"`
		SleepSeconds int    `json:"sleep_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	s.autonomMu.Lock()
	defer s.autonomMu.Unlock()

	if _, active := s.autonomous[runID]; active {
		writeError(w, http.StatusConflict, "autonomous controls already active")
		return
	}

	ctrl := &autoControl{
		goal:         body.Goal,
		maxIter:      body.MaxIter,
		maxRuntime:   time.Duration(body.MaxRuntime) * time.Second,
		maxToolCalls: body.MaxToolCalls,
		sleepTime:    time.Duration(body.SleepSeconds) * time.Second,
		started:      time.Now(),
	}
	s.autonomous[runID] = ctrl

	// Log event
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{
		Type:      "autonomous.started",
		Payload:   mustJSON(map[string]any{"goal": body.Goal}),
		CreatedAt: time.Now().UTC(),
	}, s.requestID(r))

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
}

func (s *Server) handleAutonomousStop(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")

	s.autonomMu.Lock()
	defer s.autonomMu.Unlock()

	if ctrl, ok := s.autonomous[runID]; ok {
		if ctrl.cancel != nil {
			ctrl.cancel()
		}
		delete(s.autonomous, runID)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (s *Server) handleAutonomousStatus(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")

	s.autonomMu.RLock()
	defer s.autonomMu.RUnlock()

	_, active := s.autonomous[runID]
	status := "inactive"
	if active {
		status = "active"
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}

func (s *Server) handleReplayRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	// Fetch historical events for this run
	history, err := s.store.EventHistory(r.Context(), tenant, runID, 0)
	if err != nil {
		writeError(w, http.StatusNotFound, "run or history not found")
		return
	}

	// Transform to adaptive replay format
	replayEvents := make([]adaptive.ReplayEvent, len(history))
	for i, e := range history {
		replayEvents[i] = adaptive.ReplayEvent{
			Type:    e.Type,
			Payload: e.Payload,
		}
	}

	// Simulate replay
	strategy, err := s.adaptiveEngine.Replay(r.Context(), replayEvents)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "replay failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":       runID,
		"replay_trace": strategy.Trace,
		"strategy":     strategy,
		"event_count":  len(history),
	})
}
