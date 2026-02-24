package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync/atomic"

	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/trust"
)

const maxCapsuleBytes = 10 * 1024 * 1024

type capsuleRequest struct {
	ProtocolVersion string          `json:"protocol_version"`
	Capsule         json.RawMessage `json:"capsule"`
}

type capsuleManifest struct {
	RunID          string `json:"run_id"`
	RunFingerprint string `json:"run_fingerprint"`
}

type capsuleFile struct {
	Manifest capsuleManifest  `json:"manifest"`
	EventLog []map[string]any `json:"event_log"`
}

type report struct {
	ProtocolVersion string         `json:"protocol_version"`
	RequestHash     string         `json:"request_hash"`
	CapsuleHash     string         `json:"capsule_hash"`
	Verify          bool           `json:"verify"`
	Replay          bool           `json:"replay"`
	ToolVersions    map[string]any `json:"tool_versions"`
	Signature       string         `json:"signature"`
}

type server struct {
	priv        ed25519.PrivateKey
	pub         ed25519.PublicKey
	inFlight    atomic.Int64
	maxInFlight int64
}

func main() {
	addr := flag.String("addr", ":8090", "listen address")
	max := flag.Int64("max-inflight", 10, "max concurrent validations")
	flag.Parse()

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}
	s := &server{priv: priv, pub: pub, maxInFlight: *max}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /public-key", s.publicKey)
	mux.HandleFunc("POST /validate", s.validate)
	log.Printf("reach-remote-validate listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "protocol_version": trust.RemoteProtocolVersion})
}

func (s *server) publicKey(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{"public_key": base64.StdEncoding.EncodeToString(s.pub)})
}

func (s *server) validate(w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > maxCapsuleBytes {
		http.Error(w, `{"error":"payload too large"}`, http.StatusRequestEntityTooLarge)
		return
	}
	if s.inFlight.Add(1) > s.maxInFlight {
		s.inFlight.Add(-1)
		http.Error(w, `{"error":"rate limited"}`, http.StatusTooManyRequests)
		return
	}
	defer s.inFlight.Add(-1)
	r.Body = http.MaxBytesReader(w, r.Body, maxCapsuleBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var req capsuleRequest
	if err := dec.Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if req.ProtocolVersion != trust.RemoteProtocolVersion {
		writeErr(w, http.StatusBadRequest, errors.New("protocol version mismatch"))
		return
	}
	var c capsuleFile
	if err := json.Unmarshal(req.Capsule, &c); err != nil {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid capsule: %w", err))
		return
	}
	if c.Manifest.RunID == "" || c.Manifest.RunFingerprint == "" {
		writeErr(w, http.StatusBadRequest, errors.New("invalid capsule manifest"))
		return
	}
	recomputed := determinism.HashEventLog(c.EventLog, c.Manifest.RunID)
	result := report{
		ProtocolVersion: trust.RemoteProtocolVersion,
		RequestHash:     determinism.Hash(req),
		CapsuleHash:     determinism.Hash(req.Capsule),
		Verify:          recomputed == c.Manifest.RunFingerprint,
		Replay:          recomputed == c.Manifest.RunFingerprint,
		ToolVersions:    map[string]any{"service": "reach-remote-validate", "protocol": trust.RemoteProtocolVersion},
	}
	signed := result
	payload := determinism.CanonicalJSON(signed)
	result.Signature = base64.StdEncoding.EncodeToString(ed25519.Sign(s.priv, []byte(payload)))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}
