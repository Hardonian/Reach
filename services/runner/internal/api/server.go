package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/jobs"
)

type Server struct {
	store          *jobs.Store
	requestCounter atomic.Uint64
	plugins        []PluginManifest
}

func NewServer(store *jobs.Store) *Server {
	return &Server{store: store, plugins: loadPlugins()}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/runs", s.handleCreateRun)
	mux.HandleFunc("GET /v1/runs/{id}/events", s.handleStreamEvents)
	mux.HandleFunc("POST /v1/runs/{id}/tool-result", s.handleToolResult)
	mux.HandleFunc("GET /v1/runs/{id}/audit", s.handleGetAudit)
	mux.HandleFunc("POST /v1/runs/{id}/export", s.handleExport)
	mux.HandleFunc("POST /v1/runs/import", s.handleImport)
	mux.HandleFunc("POST /v1/runs/{id}/gates/{gate_id}", s.handleGateDecision)
	mux.HandleFunc("GET /v1/plugins", s.handleListPlugins)
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
	var body struct {
		ToolName             string         `json:"tool_name"`
		RequiredCapabilities []string       `json:"required_capabilities"`
		Result               map[string]any `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	pluginID, pluginCaps := requiredPluginCapabilities(s.plugins, body.ToolName)
	required := append([]string(nil), body.RequiredCapabilities...)
	required = append(required, pluginCaps...)
	if err := s.store.CheckCapabilities(runID, required); err != nil {
		gateID := fmt.Sprintf("gate-%d", time.Now().UnixNano())
		_ = s.store.SetGate(runID, jobs.Gate{ID: gateID, Tool: body.ToolName, Capabilities: required, Reason: err.Error()})
		payload, _ := json.Marshal(map[string]any{"run_id": runID, "tool": body.ToolName, "capabilities": required, "reason": err.Error(), "gate_id": gateID})
		_ = s.store.PublishEvent(runID, jobs.Event{Type: "policy.gate.requested", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
		_ = s.store.Audit(runID, requestID, "policy.gate.requested", map[string]any{"gate_id": gateID, "tool": body.ToolName, "plugin_id": pluginID})
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	_ = s.store.Audit(runID, requestID, "tool.result.received", map[string]any{"tool_name": body.ToolName, "plugin_id": pluginID, "result": body.Result})
	payload, _ := json.Marshal(map[string]any{"type": "tool_result", "tool": body.ToolName, "result": body.Result})
	_ = s.store.PublishEvent(runID, jobs.Event{Type: "tool.result", Payload: payload, CreatedAt: time.Now().UTC()}, requestID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "request_id": requestID})
}

func (s *Server) handleGateDecision(w http.ResponseWriter, r *http.Request) {
	runID, gateID := r.PathValue("id"), r.PathValue("gate_id")
	var body struct {
		Decision jobs.GateDecision `json:"decision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := s.store.ResolveGate(runID, gateID, body.Decision); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	payload, _ := json.Marshal(map[string]any{"gate_id": gateID, "decision": body.Decision})
	_ = s.store.PublishEvent(runID, jobs.Event{Type: "policy.gate.resolved", Payload: payload, CreatedAt: time.Now().UTC()}, s.requestID(r))
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"plugins": s.plugins})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	history, err := s.store.EventHistory(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	audit, _ := s.store.ListAudit(runID)
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	writeZip := func(name string, body []byte) { f, _ := zw.Create(name); _, _ = f.Write(body) }
	manifest, _ := json.Marshal(map[string]any{"version": "0.1.0", "run_id": runID, "created_at": "1970-01-01T00:00:00Z", "files": []string{"events.ndjson", "toolcalls.ndjson", "audit.ndjson"}})
	writeZip("manifest.json", manifest)
	var events bytes.Buffer
	for _, e := range history {
		events.Write(e.Payload)
		events.WriteByte('\n')
	}
	writeZip("events.ndjson", events.Bytes())
	writeZip("toolcalls.ndjson", []byte(""))
	var audits bytes.Buffer
	for _, a := range audit {
		line, _ := json.Marshal(a)
		audits.Write(line)
		audits.WriteByte('\n')
	}
	writeZip("audit.ndjson", audits.Bytes())
	_ = zw.Close()
	w.Header().Set("Content-Type", "application/zip")
	_, _ = w.Write(buf.Bytes())
}

func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	data, _ := io.ReadAll(r.Body)
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid capsule")
		return
	}
	var eventsFile io.ReadCloser
	for _, f := range zr.File {
		if f.Name == "events.ndjson" {
			eventsFile, _ = f.Open()
			break
		}
	}
	if eventsFile == nil {
		writeError(w, http.StatusBadRequest, "events.ndjson missing")
		return
	}
	defer eventsFile.Close()
	run := s.store.CreateRun(s.requestID(r), nil)
	lines, _ := io.ReadAll(eventsFile)
	for _, line := range strings.Split(strings.TrimSpace(string(lines)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		_ = s.store.PublishEvent(run.ID, jobs.Event{Type: "replay.event", Payload: []byte(line), CreatedAt: time.Now().UTC()}, "import")
	}
	writeJSON(w, http.StatusCreated, map[string]string{"run_id": run.ID, "mode": "replay"})
}

func (s *Server) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.ListAudit(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	run, err := s.store.GetRun(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "event: heartbeat\ndata: {\"status\":\"ok\"}\n\n")
	history, _ := s.store.EventHistory(run.ID)
	for _, evt := range history {
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", sanitizeEventName(evt.Type), evt.Payload)
	}
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case evt := <-run.Events:
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", sanitizeEventName(evt.Type), evt.Payload)
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

var _ = errors.Is

type PluginManifest struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Version string       `json:"version"`
	Tools   []PluginTool `json:"tools"`
}

type PluginTool struct {
	Name                 string   `json:"name"`
	RequiredCapabilities []string `json:"required_capabilities"`
}

func loadPlugins() []PluginManifest {
	dirs := []string{"services/runner/plugins", "../plugins", "plugins"}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		out := make([]PluginManifest, 0)
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, e.Name(), "manifest.json"))
			if err != nil {
				continue
			}
			var m PluginManifest
			if json.Unmarshal(data, &m) == nil && m.ID != "" {
				out = append(out, m)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return []PluginManifest{}
}

func requiredPluginCapabilities(plugins []PluginManifest, tool string) (string, []string) {
	for _, p := range plugins {
		for _, t := range p.Tools {
			if t.Name == tool {
				return p.ID, t.RequiredCapabilities
			}
		}
	}
	return "", nil
}
