package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/jobs"
)

type Server struct {
	store          *jobs.Store
	requestCounter atomic.Uint64
}

func NewServer(store *jobs.Store) *Server {
	return &Server{store: store}
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

	payload, err := json.Marshal(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid tool result payload")
		return
	}

	if err := s.store.PublishEvent(runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, requestID); err != nil {
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
