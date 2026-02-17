package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"reach/services/capsule-sync/internal/store"
)

func sign(tenant, id, devType, trust string) string {
	mac := hmac.New(sha256.New, []byte("dev-device-secret"))
	mac.Write([]byte(tenant + ":" + id + ":" + devType + ":" + trust))
	return hex.EncodeToString(mac.Sum(nil))
}

func register(t *testing.T, h http.Handler, tenant, id, devType, trust string) {
	t.Helper()
	payload := map[string]any{"id": id, "tenant_id": tenant, "device_type": devType, "trust_level": trust, "signature": sign(tenant, id, devType, trust)}
	b, _ := json.Marshal(payload)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/devices/register", bytes.NewReader(b)))
	if rec.Code != http.StatusCreated {
		t.Fatalf("register failed %d %s", rec.Code, rec.Body.String())
	}
}

func TestCapsuleSyncIdempotency(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "android", "trusted")
	payload := `{"tenant_id":"t1","plan":"pro","idempotency_key":"same","device":{"id":"d1","tenant_id":"t1","device_type":"android","trust_level":"trusted","signature":"` + sign("t1", "d1", "android", "trusted") + `"},"metadata":{"session_id":"s1","device_version":1,"repo_metadata":{"profile":{"mode":"metadata"}}}}`
	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	if rec1.Body.String() != rec2.Body.String() {
		t.Fatalf("expected idempotent response")
	}
}

func TestTierRestrictionEnforcement(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "android", "trusted")
	payload := `{"tenant_id":"t1","plan":"free","device":{"id":"d1","tenant_id":"t1","device_type":"android","trust_level":"trusted","signature":"` + sign("t1", "d1", "android", "trusted") + `"},"metadata":{"session_id":"s2","device_version":1,"repo_metadata":{"profile":{"mode":"diff-only"}}}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 got %d", rec.Code)
	}
}

func TestDeviceTrustValidation(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "android", "untrusted")
	payload := `{"tenant_id":"t1","plan":"pro","device":{"id":"d1","tenant_id":"t1","device_type":"android","trust_level":"untrusted","signature":"` + sign("t1", "d1", "android", "untrusted") + `"},"metadata":{"session_id":"s3","device_version":1,"repo_metadata":{"profile":{"mode":"metadata"}}}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected trust rejection got %d", rec.Code)
	}
}

func TestRepoSyncModeEnforcement(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "ios", "trusted")
	payload := `{"tenant_id":"t1","plan":"pro","device":{"id":"d1","tenant_id":"t1","device_type":"ios","trust_level":"trusted","signature":"` + sign("t1", "d1", "ios", "trusted") + `"},"metadata":{"session_id":"s4","device_version":1,"repo_metadata":{"profile":{"mode":"full"},"raw_content":"abc"}}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for pro full got %d", rec.Code)
	}
}

func TestConfigSyncWorks(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "ios", "trusted")
	seed := `{"tenant_id":"t1","plan":"pro","device":{"id":"d1","tenant_id":"t1","device_type":"ios","trust_level":"trusted","signature":"` + sign("t1", "d1", "ios", "trusted") + `"},"metadata":{"session_id":"s5","device_version":1,"repo_metadata":{"profile":{"mode":"metadata"}}}}`
	recSeed := httptest.NewRecorder()
	h.ServeHTTP(recSeed, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(seed)))
	patch := `{"plan":"pro","workspace_config":{"model_provider_default":"gpt"}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPatch, "/v1/capsules/s5", bytes.NewBufferString(patch)))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected patch ok got %d %s", rec.Code, rec.Body.String())
	}
}

func TestNoRawRepoContentStoredInFreeTier(t *testing.T) {
	h := New(store.New(), "test").Handler()
	register(t, h, "t1", "d1", "android", "trusted")
	payload := `{"tenant_id":"t1","plan":"free","device":{"id":"d1","tenant_id":"t1","device_type":"android","trust_level":"trusted","signature":"` + sign("t1", "d1", "android", "trusted") + `"},"metadata":{"session_id":"s6","device_version":1,"repo_metadata":{"profile":{"mode":"metadata"},"raw_content":"SECRET"}}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/capsules/sync", bytes.NewBufferString(payload)))
	if rec.Code != http.StatusOK {
		t.Fatalf("sync failed %d %s", rec.Code, rec.Body.String())
	}
	getRec := httptest.NewRecorder()
	h.ServeHTTP(getRec, httptest.NewRequest(http.MethodGet, "/v1/capsules/s6", nil))
	if bytes.Contains(getRec.Body.Bytes(), []byte("SECRET")) {
		t.Fatalf("raw content leaked for free tier")
	}
}
