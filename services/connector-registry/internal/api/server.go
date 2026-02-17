package api

import (
	"encoding/json"
	"net/http"

	"reach/services/connector-registry/internal/registry"
)

type Server struct{ store *registry.Store }

func New(store *registry.Store) *Server { return &Server{store: store} }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/connectors", s.list)
	mux.HandleFunc("POST /v1/connectors/install", s.install)
	return mux
}

func (s *Server) list(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"connectors": s.store.List()})
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
