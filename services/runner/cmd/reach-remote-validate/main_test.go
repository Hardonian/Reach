package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/trust"
)

func newTestServer(t *testing.T) *server {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return &server{priv: priv, pub: pub, maxInFlight: 10}
}

func TestValidateRejectsInvalidPayload(t *testing.T) {
	s := newTestServer(t)
	r := httptest.NewRequest(http.MethodPost, "/validate", bytes.NewBufferString("not json"))
	w := httptest.NewRecorder()
	s.validate(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestValidateAcceptsValidCapsule(t *testing.T) {
	s := newTestServer(t)
	cap := map[string]any{
		"manifest":  map[string]any{"run_id": "run-1", "run_fingerprint": determinism.HashEventLog([]map[string]any{{"a": 1}}, "run-1")},
		"event_log": []map[string]any{{"a": 1}},
	}
	body, _ := json.Marshal(map[string]any{"protocol_version": trust.RemoteProtocolVersion, "capsule": cap})
	r := httptest.NewRequest(http.MethodPost, "/validate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	s.validate(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	var rep report
	if err := json.Unmarshal(w.Body.Bytes(), &rep); err != nil {
		t.Fatal(err)
	}
	if rep.Signature == "" {
		t.Fatal("expected signature")
	}
}
