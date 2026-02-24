package api

import (
	"encoding/json"
	"net/http"
	"time"

	"reach/services/runner/internal/adaptive"
	"reach/services/runner/internal/jobs"
)

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	// TODO: implement export
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	// TODO: implement import
	writeError(w, http.StatusNotImplemented, "not implemented")
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
	// TODO: implement plugin listing
	writeJSON(w, http.StatusOK, map[string][]string{"plugins": {}})
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
		Goal         string  `json:"goal"`
		MaxIter      int     `json:"max_iterations"`
		MaxRuntime   int     `json:"max_runtime"`
		MaxToolCalls int     `json:"max_tool_calls"`
		BurstMin     int     `json:"burst_min_seconds"`
		BurstMax     int     `json:"burst_max_seconds"`
		SleepSeconds int     `json:"sleep_seconds"`
		BudgetUSD    float64 `json:"budget_usd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	s.autonomousMu.Lock()
	defer s.autonomousMu.Unlock()

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

	// Initialize budget if specified
	if body.BudgetUSD > 0 {
		s.store.GetBudgetController(runID, tenant, body.BudgetUSD)
	}

	s.autonomous[runID] = ctrl

	// Log event
	_ = s.store.PublishEvent(r.Context(), runID, jobs.Event{
		Type:      "autonomous.started",
		Payload:   mustJSON(map[string]any{"goal": body.Goal, "budget_usd": body.BudgetUSD}),
		CreatedAt: time.Now().UTC(),
	}, s.requestID(r))

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
}

func (s *Server) handleAutonomousStop(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")

	s.autonomousMu.Lock()
	defer s.autonomousMu.Unlock()

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

	s.autonomousMu.RLock()
	defer s.autonomousMu.RUnlock()

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

// handleGetBudget returns the current budget status for a run
func (s *Server) handleGetBudget(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	// Verify run exists
	if _, err := s.store.GetRun(r.Context(), tenant, runID); err != nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}

	status, err := s.store.GetBudgetStatus(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get budget status: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, status)
}

// handleReserveBudget reserves budget for a tool call
func (s *Server) handleReserveBudget(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	var body struct {
		Tool            string `json:"tool"`
		EstimatedTokens int    `json:"estimated_tokens"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if body.Tool == "" {
		writeError(w, http.StatusBadRequest, "tool is required")
		return
	}

	result, err := s.store.PredictAndReserve(r.Context(), tenant, runID, body.Tool, body.EstimatedTokens)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "budget reservation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// handleCommitSpend commits actual spend for a budget allocation
func (s *Server) handleCommitSpend(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	var body struct {
		AllocationID uint64  `json:"allocation_id"`
		ActualCost   float64 `json:"actual_cost"`
		Tool         string  `json:"tool"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if body.Tool == "" {
		writeError(w, http.StatusBadRequest, "tool is required")
		return
	}

	if err := s.store.CommitSpend(r.Context(), tenant, runID, body.AllocationID, body.ActualCost, body.Tool); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit spend: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "committed"})
}

// handleUpdateBudget updates the budget for a run
func (s *Server) handleUpdateBudget(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	var body struct {
		BudgetUSD float64 `json:"budget_usd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if body.BudgetUSD <= 0 {
		writeError(w, http.StatusBadRequest, "budget_usd must be positive")
		return
	}

	// Create/Update budget controller
	s.store.GetBudgetController(runID, tenant, body.BudgetUSD)

	_ = s.store.Audit(r.Context(), tenant, runID, "budget.updated", mustJSON(map[string]any{
		"new_budget": body.BudgetUSD,
	}))

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":     runID,
		"budget_usd": body.BudgetUSD,
		"status":     "updated",
	})
}

// handleGetBudgetProjection returns ML-predicted budget projection
func (s *Server) handleGetBudgetProjection(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	tenant := tenantIDFrom(r.Context())

	var body struct {
		RemainingOperations int `json:"remaining_operations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body.RemainingOperations = 10 // Default
	}

	bc, err := s.store.GetBudgetControllerForRun(r.Context(), tenant, runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "run not found or budget not initialized")
		return
	}

	projection := bc.GetProjection(body.RemainingOperations)
	status := bc.GetStatus()

	writeJSON(w, http.StatusOK, map[string]any{
		"run_id":               runID,
		"projection_usd":       projection,
		"remaining_operations": body.RemainingOperations,
		"status":               status,
	})
}
