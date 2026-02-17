package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"reach/services/billing/tier"
	"reach/services/capsule-sync/internal/core"
	"reach/services/capsule-sync/internal/store"
)

type Server struct {
	store   *store.SyncStore
	secret  []byte
	version string
}

func New(s *store.SyncStore, version string) *Server {
	secret := []byte(os.Getenv("DEVICE_SIGNING_SECRET"))
	if len(secret) == 0 {
		secret = []byte("dev-device-secret")
	}
	if strings.TrimSpace(version) == "" {
		version = "dev"
	}
	return &Server{store: s, secret: secret, version: version}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "version": s.version})
	})
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"version": s.version})
	})
	mux.HandleFunc("POST /v1/devices/register", s.handleRegisterDevice)
	mux.HandleFunc("POST /v1/capsules/sync", s.handleSync)
	mux.HandleFunc("GET /v1/capsules/{session_id}", s.handleGet)
	mux.HandleFunc("PATCH /v1/capsules/{session_id}", s.handlePatch)
	return mux
}

func (s *Server) handleRegisterDevice(w http.ResponseWriter, r *http.Request) {
	var d core.Device
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if d.ID == "" || d.TenantID == "" || d.DeviceType == "" || d.TrustLevel == "" {
		writeErr(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if !s.verifySignature(d) {
		writeErr(w, http.StatusForbidden, "invalid device signature")
		return
	}
	s.store.RegisterDevice(d)
	writeJSON(w, http.StatusCreated, map[string]any{"registered": true, "device": d})
}

func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	var req core.SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Metadata.SessionID == "" || req.TenantID == "" || req.Device.ID == "" {
		writeErr(w, http.StatusBadRequest, "tenant_id, session_id, and device.id are required")
		return
	}
	reg, ok := s.store.Device(req.TenantID, req.Device.ID)
	if !ok || reg.Signature != req.Device.Signature {
		writeErr(w, http.StatusForbidden, "device must be registered")
		return
	}
	if !trusted(req.Device.TrustLevel) {
		writeErr(w, http.StatusForbidden, "sync requires trusted device")
		return
	}
	if err := enforceTier(&req); err != nil {
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	resp := s.store.Upsert(req)
	writeJSON(w, http.StatusOK, resp)
}

func enforceTier(req *core.SyncRequest) error {
	plan := tier.ParsePlan(req.Plan)
	switch req.Metadata.RepoMetadata.Profile.Mode {
	case core.RepoSyncMetadata:
		if !tier.Allows(plan, tier.FeatureRepoMetadataOnly) {
			return errors.New("plan does not allow metadata sync")
		}
		req.Metadata.RepoMetadata.RawContent = ""
	case core.RepoSyncDiffOnly:
		if !tier.Allows(plan, tier.FeatureRepoDiffSync) {
			return errors.New("plan does not allow diff-only sync")
		}
		req.Metadata.RepoMetadata.RawContent = ""
	case core.RepoSyncFull:
		if !tier.Allows(plan, tier.FeatureRepoFullSync) {
			return errors.New("plan does not allow full sync")
		}
	default:
		return errors.New("invalid repo sync mode")
	}
	if plan == tier.PlanFree {
		req.Metadata.WorkspaceConfig = core.WorkspaceConfig{}
	}
	if plan != tier.PlanEnterprise {
		req.Metadata.RepoMetadata.RawContent = ""
	}
	return nil
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("session_id")
	meta, err := s.store.Get(sessionID)
	if err != nil {
		writeErr(w, http.StatusNotFound, "capsule not found")
		return
	}
	writeJSON(w, http.StatusOK, meta)
}

func (s *Server) handlePatch(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("session_id")
	var body struct {
		Plan            string                `json:"plan"`
		WorkspaceConfig *core.WorkspaceConfig `json:"workspace_config,omitempty"`
		RepoMetadata    *core.RepoMetadata    `json:"repo_metadata,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	plan := tier.ParsePlan(body.Plan)
	meta, err := s.store.Patch(sessionID, func(m *core.CapsuleMetadata) error {
		if body.WorkspaceConfig != nil {
			if !tier.Allows(plan, tier.FeatureCloudConfigSync) {
				return errors.New("plan does not allow cloud config sync")
			}
			m.WorkspaceConfig = *body.WorkspaceConfig
		}
		if body.RepoMetadata != nil {
			m.RepoMetadata = *body.RepoMetadata
			req := core.SyncRequest{Plan: body.Plan, Metadata: *m}
			if err := enforceTier(&req); err != nil {
				return err
			}
			m.RepoMetadata = req.Metadata.RepoMetadata
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "capsule not found")
			return
		}
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, meta)
}

func trusted(level string) bool {
	switch strings.ToLower(level) {
	case "trusted", "managed", "hardware-backed":
		return true
	default:
		return false
	}
}

func (s *Server) verifySignature(d core.Device) bool {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(d.TenantID + ":" + d.ID + ":" + d.DeviceType + ":" + d.TrustLevel))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(strings.ToLower(d.Signature)))
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
