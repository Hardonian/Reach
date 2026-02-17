package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/engineclient"
	"reach/services/runner/internal/jobs"
)

type Server struct {
	store          *jobs.Store
	requestCounter atomic.Uint64
	store  *jobs.Store
	engine *engineclient.Client
}

func NewServer(store *jobs.Store) *Server {
	return &Server{store: store, engine: engineclient.New("")}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/runs", s.handleCreateRun)
	mux.HandleFunc("GET /v1/runs/{id}/events", s.handleStreamEvents)
	mux.HandleFunc("POST /v1/runs/{id}/tool-result", s.handleToolResult)
	mux.HandleFunc("GET /v1/runs/{id}/audit", s.handleGetAudit)
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
type createRunRequest struct {
	Workflow  json.RawMessage `json:"workflow"`
	Initiator string          `json:"initiator"`
}

func (s *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	var req createRunRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if len(req.Workflow) == 0 {
		req.Workflow = defaultWorkflow()
	}
	if req.Initiator == "" {
		req.Initiator = "runner.api"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	compiled, err := s.engine.CompileWorkflow(ctx, req.Workflow)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	run := s.store.CreateRun()
	handle, events, err := s.engine.StartRun(ctx, run.ID, compiled, req.Initiator)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.SetEngineState(run.ID, handle); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.publishEngineEvents(run.ID, events); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.advanceRun(ctx, run.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"run_id": run.ID})
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
	requestID := s.requestID(r)
	runID := r.PathValue("id")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "missing run id")
		return
	}

	if _, err := s.store.GetRun(runID); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, jobs.ErrRunNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
		StepID   string          `json:"step_id"`
		ToolName string          `json:"tool_name"`
		Output   json.RawMessage `json:"output"`
		Success  bool            `json:"success"`
		Error    *string         `json:"error"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.ToolName == "" {
		writeError(w, http.StatusBadRequest, "missing tool_name")
		return
	}

	_ = s.store.Audit(runID, requestID, "engine.action.requested", map[string]any{
		"tool_name":             body.ToolName,
		"required_capabilities": body.RequiredCapabilities,
	})

	if err := s.store.CheckCapabilities(runID, body.RequiredCapabilities); err != nil {
		_ = s.store.Audit(runID, requestID, "tool.execution.rejected", map[string]any{"reason": err.Error()})
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	_ = s.store.Audit(runID, requestID, "tool.call.executed", map[string]any{"tool_name": body.ToolName})
	_ = s.store.Audit(runID, requestID, "tool.result.received", map[string]any{"tool_name": body.ToolName, "result": body.Result})
	if body.StepID == "" || body.ToolName == "" {
		writeError(w, http.StatusBadRequest, "missing step_id or tool_name")
		return
	}
	if len(body.Output) == 0 {
		body.Output = []byte(`{}`)
	}

	state, err := s.store.EngineState(runID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(state) == 0 {
		writeError(w, http.StatusConflict, "run has no engine state")
		return
	}

	if err := s.store.PublishEvent(runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, requestID); err != nil {
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	nextState, events, err := s.engine.ApplyToolResult(ctx, runID, state, engineclient.ToolResult{
		StepID:   body.StepID,
		ToolName: body.ToolName,
		Output:   body.Output,
		Success:  body.Success,
		Error:    body.Error,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.store.SetEngineState(runID, nextState); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.publishEngineEvents(runID, events); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.advanceRun(ctx, runID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "request_id": requestID})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "missing run id")
		return
	}

	entries, err := s.store.ListAudit(runID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, jobs.ErrRunNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "missing run id")
		return
	}

	run, err := s.store.GetRun(runID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, jobs.ErrRunNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	fmt.Fprintf(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")

	history, err := s.store.EventHistory(runID)
	if err == nil {
		for _, evt := range history {
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", sanitizeEventName(evt.Type), evt.Payload)
		}
	}
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-run.Events:
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", sanitizeEventName(evt.Type), evt.Payload)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprintf(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")
			flusher.Flush()
		}
	}
}

func (s *Server) requestID(r *http.Request) string {
	if rid := strings.TrimSpace(r.Header.Get("X-Request-Id")); rid != "" {
		return rid
	}
	return fmt.Sprintf("req-%09d", s.requestCounter.Add(1))
func (s *Server) advanceRun(ctx context.Context, runID string) error {
	for {
		state, err := s.store.EngineState(runID)
		if err != nil {
			return err
		}
		nextState, events, action, err := s.engine.NextAction(ctx, runID, state)
		if err != nil {
			return err
		}
		if err := s.store.SetEngineState(runID, nextState); err != nil {
			return err
		}
		if err := s.publishEngineEvents(runID, events); err != nil {
			return err
		}

		var actionType struct {
			Type string `json:"type"`
		}
		if len(action) == 0 {
			return nil
		}
		if err := json.Unmarshal(action, &actionType); err != nil {
			return err
		}
		if actionType.Type == "done" || actionType.Type == "tool_call" {
			return nil
		}
	}
}

func (s *Server) publishEngineEvents(runID string, events []engineclient.Event) error {
	for _, evt := range events {
		payload, err := json.Marshal(evt)
		if err != nil {
			return err
		}
		if err := s.store.PublishEvent(runID, jobs.Event{Type: evt.Type, Payload: payload, CreatedAt: time.Now().UTC()}); err != nil {
			return err
		}
	}
	return nil
}

func defaultWorkflow() json.RawMessage {
	return []byte(`{"id":"default","version":"0.1.0","steps":[{"id":"step-1","kind":{"type":"tool_call","tool":{"name":"echo","description":"Echo input","input_schema":{"type":"object"},"output_schema":{"type":"object"}},"input":{"message":"hello"}}}]}`)
}

func sanitizeEventName(name string) string {
	if strings.TrimSpace(name) == "" {
		return "message"
	}
	return strings.ReplaceAll(name, "\n", "")
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
