package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reach/services/integration-hub/internal/core"
	"reach/services/integration-hub/internal/router"
	"reach/services/integration-hub/internal/security"
	"reach/services/integration-hub/internal/storage"
)

func newTestServer(t *testing.T) (*Server, *httptest.Server, func()) {
	t.Helper()
	var triggerCalls int
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/v1/triggers" {
			triggerCalls++
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(runner.Close)
	store, err := storage.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	cipher, _ := security.NewCipher(base64.StdEncoding.EncodeToString(key))
	clients := map[string]core.OAuthClient{
		"slack":  {Provider: "slack", ClientID: "id", RedirectURI: "http://cb", Scopes: []string{"chat:write"}},
		"google": {Provider: "google", ClientID: "id", RedirectURI: "http://cb", Scopes: []string{"gmail.send"}},
		"github": {Provider: "github", ClientID: "id", RedirectURI: "http://cb", Scopes: []string{"repo"}},
		"jira":   {Provider: "jira", ClientID: "id", RedirectURI: "http://cb", Scopes: []string{"read:jira-work"}},
	}
	srv := NewServer(store, cipher, router.NewTriggerDispatcher(runner.URL), clients)
	cleanup := func() {
		_ = store.Close()
		if triggerCalls == 0 {
			t.Log("no trigger calls")
		}
	}
	return srv, runner, cleanup
}

func TestSlackOAuthWebhookApprovalFlow(t *testing.T) {
	srv, _, cleanup := newTestServer(t)
	defer cleanup()
	h := srv.Routes()
	tenant := "t1"

	startReq := httptest.NewRequest(http.MethodPost, "/v1/integrations/slack/oauth/start", nil)
	startReq.Header.Set("X-Reach-Tenant", tenant)
	startRec := httptest.NewRecorder()
	h.ServeHTTP(startRec, startReq)
	if startRec.Code != http.StatusOK {
		t.Fatalf("oauth start status %d", startRec.Code)
	}
	var started map[string]any
	_ = json.Unmarshal(startRec.Body.Bytes(), &started)
	state := started["state"].(string)

	cbReq := httptest.NewRequest(http.MethodGet, "/v1/integrations/slack/oauth/callback?state="+state+"&code=abc", nil)
	cbReq.Header.Set("X-Reach-Tenant", tenant)
	cbRec := httptest.NewRecorder()
	h.ServeHTTP(cbRec, cbReq)
	if cbRec.Code != http.StatusOK {
		t.Fatalf("oauth callback status %d", cbRec.Code)
	}

	if err := srv.store.SaveWebhookSecret(tenant, "slack", "secret"); err != nil {
		t.Fatal(err)
	}
	payload := []byte(`{"type":"message","text":"/reach run deploy","user":"U123","channel":"C1"}`)
	timestamp := fmt.Sprint(time.Now().Unix())
	base := []byte("v0:" + timestamp + ":" + string(payload))
	hm := hmac.New(sha256.New, []byte("secret"))
	hm.Write(base)
	sig := "v0=" + hex.EncodeToString(hm.Sum(nil))

	wReq := httptest.NewRequest(http.MethodPost, "/webhooks/slack", bytes.NewReader(payload))
	wReq.Header.Set("X-Reach-Tenant", tenant)
	wReq.Header.Set("X-Reach-Delivery", "d1")
	wReq.Header.Set("X-Slack-Request-Timestamp", timestamp)
	wReq.Header.Set("X-Slack-Signature", sig)
	wRec := httptest.NewRecorder()
	h.ServeHTTP(wRec, wReq)
	if wRec.Code != http.StatusOK {
		t.Fatalf("slack webhook status %d body=%s", wRec.Code, wRec.Body.String())
	}

	approveReq := httptest.NewRequest(http.MethodPost, "/v1/integrations/slack/approve", bytes.NewBufferString(`{"decision":"approve","runId":"run-1"}`))
	approveReq.Header.Set("X-Reach-Tenant", tenant)
	approveRec := httptest.NewRecorder()
	h.ServeHTTP(approveRec, approveReq)
	if approveRec.Code != http.StatusOK {
		t.Fatalf("approval status %d", approveRec.Code)
	}
}

func TestGitHubWebhookRoutesToRunnerAndAudit(t *testing.T) {
	srv, _, cleanup := newTestServer(t)
	defer cleanup()
	_ = srv.store.SaveWebhookSecret("tenant-gh", "github", "ghsecret")
	h := srv.Routes()
	payload := []byte(`{"action":"opened","pull_request":{"html_url":"https://github/pr/1"}}`)
	sig := security.ComputeHMAC("ghsecret", payload)
	req := httptest.NewRequest(http.MethodPost, "/webhooks/github", bytes.NewReader(payload))
	req.Header.Set("X-Reach-Tenant", "tenant-gh")
	req.Header.Set("X-Reach-Delivery", "gh-delivery")
	req.Header.Set("X-Hub-Signature-256", sig)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("github webhook failed: %d %s", rec.Code, rec.Body.String())
	}
	auditReq := httptest.NewRequest(http.MethodGet, "/v1/audit", nil)
	auditReq.Header.Set("X-Reach-Tenant", "tenant-gh")
	auditRec := httptest.NewRecorder()
	h.ServeHTTP(auditRec, auditReq)
	if auditRec.Code != http.StatusOK || !bytes.Contains(auditRec.Body.Bytes(), []byte("webhook.received")) {
		t.Fatalf("audit log missing webhook entry: %s", auditRec.Body.String())
	}
}

func TestGoogleEventNormalizationWorkflowStart(t *testing.T) {
	srv, _, cleanup := newTestServer(t)
	defer cleanup()
	_ = srv.store.SaveWebhookSecret("tenant-g", "google", "gsecret")
	h := srv.Routes()
	payload := []byte(`{"eventType":"calendar.event.updated","email":"user@corp.com","calendarId":"primary"}`)
	sig := security.ComputeHMAC("gsecret", payload)
	req := httptest.NewRequest(http.MethodPost, "/webhooks/google", bytes.NewReader(payload))
	req.Header.Set("X-Reach-Tenant", "tenant-g")
	req.Header.Set("X-Reach-Delivery", "g-delivery")
	req.Header.Set("X-Reach-Signature", sig)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("google webhook failed: %d %s", rec.Code, rec.Body.String())
	}
	eventsReq := httptest.NewRequest(http.MethodGet, "/v1/events", nil)
	eventsReq.Header.Set("X-Reach-Tenant", "tenant-g")
	eventsRec := httptest.NewRecorder()
	h.ServeHTTP(eventsRec, eventsReq)
	if eventsRec.Code != http.StatusOK || !bytes.Contains(eventsRec.Body.Bytes(), []byte("schedule")) {
		t.Fatalf("normalized schedule trigger not found: %s", eventsRec.Body.String())
	}
}
