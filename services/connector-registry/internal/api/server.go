package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"reach/services/connector-registry/internal/registry"
)

type Server struct {
	store   *registry.Store
	version string
}

func New(store *registry.Store, version string) *Server {
	if version == "" {
		version = "dev"
	}
	return &Server{store: store, version: version}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("GET /v1/connectors", s.list)
	mux.HandleFunc("POST /v1/connectors/install", s.install)
	mux.HandleFunc("DELETE /v1/connectors/", s.uninstall)
	return mux
}

func (s *Server) list(w http.ResponseWriter, _ *http.Request) {
	available, err := s.store.Available()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"installed": s.store.ListInstalled(), "available": available})
}

func (s *Server) install(w http.ResponseWriter, r *http.Request) {
	var req registry.InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	installed, err := s.store.Install(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, installed)
}

func (s *Server) uninstall(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/connectors/")
	if id == "" {
		http.Error(w, "connector id required", http.StatusBadRequest)
		return
	}
	if err := s.store.Uninstall(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
