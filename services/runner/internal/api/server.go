package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"reach/services/runner/internal/jobs"
)

type Server struct {
	store *jobs.Store
}

func NewServer(store *jobs.Store) *Server {
	return &Server{store: store}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/runs", s.handleCreateRun)
	mux.HandleFunc("GET /v1/runs/{id}/events", s.handleStreamEvents)
	mux.HandleFunc("POST /v1/runs/{id}/tool-result", s.handleToolResult)
	return mux
}

func (s *Server) handleCreateRun(w http.ResponseWriter, _ *http.Request) {
	r := s.store.CreateRun()
	writeJSON(w, http.StatusCreated, map[string]string{"run_id": r.ID})
}

func (s *Server) handleToolResult(w http.ResponseWriter, r *http.Request) {
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

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	payload, err := json.Marshal(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid tool result payload")
		return
	}

	if err := s.store.PublishEvent(runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
