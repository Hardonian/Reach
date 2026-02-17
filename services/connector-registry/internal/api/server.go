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
	mux.HandleFunc("POST /v1/connectors/upgrade", s.upgrade)
	mux.HandleFunc("DELETE /v1/connectors/", s.uninstall)
	mux.HandleFunc("GET /v1/marketplace/catalog", s.marketplaceCatalog)
	mux.HandleFunc("GET /v1/marketplace/items/", s.marketplaceItem)
	mux.HandleFunc("POST /v1/marketplace/install-intent", s.marketplaceInstallIntent)
	mux.HandleFunc("POST /v1/marketplace/install", s.marketplaceInstall)
	mux.HandleFunc("POST /v1/marketplace/update", s.marketplaceUpdate)
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

func (s *Server) upgrade(w http.ResponseWriter, r *http.Request) {
	var req registry.InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.ID == "" {
		http.Error(w, "connector id required", http.StatusBadRequest)
		return
	}
	installed, err := s.store.Upgrade(req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, installed)
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

func (s *Server) marketplaceCatalog(w http.ResponseWriter, r *http.Request) {
	page, err := s.store.ListMarketplaceCatalog(r.Context(), registry.CatalogFilterFromQuery(r.URL.Query()))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) marketplaceItem(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v1/marketplace/items/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		http.Error(w, "kind and id required", http.StatusBadRequest)
		return
	}
	item, err := s.store.GetMarketplaceItem(r.Context(), parts[0], parts[1])
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) marketplaceInstallIntent(w http.ResponseWriter, r *http.Request) {
	var req registry.InstallIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	intent, err := s.store.InstallIntent(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, intent)
}

func (s *Server) marketplaceInstall(w http.ResponseWriter, r *http.Request) {
	var req registry.InstallRequestV1
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	installed, err := s.store.InstallMarketplace(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, installed)
}

func (s *Server) marketplaceUpdate(w http.ResponseWriter, r *http.Request) {
	var req registry.InstallRequestV1
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	installed, err := s.store.UpdateMarketplace(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, installed)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
