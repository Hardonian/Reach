package api

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reach/services/runner/internal/autonomous"
	"reach/services/runner/internal/registry"
	"reach/services/runner/internal/storage"
	"strings"
	"testing"
	"time"
)

type passExecutor struct{}

func (passExecutor) Execute(_ context.Context, _ autonomous.ExecutionEnvelope) (*autonomous.ExecutionResult, error) {
	return &autonomous.ExecutionResult{Status: autonomous.StatusSuccess}, nil
}

func newAuthedServer(t *testing.T) (*Server, *storage.SQLiteStore, *http.Cookie) {
	t.Helper()
	tempDir := t.TempDir()
	db, err := storage.NewSQLiteStore(filepath.Join(tempDir, "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	srv := NewServer(db, "test")
	login := httptest.NewRecorder()
	srv.Handler().ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/auth/dev-login", bytes.NewBufferString(`{}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("dev login failed %d", login.Code)
	}
	for _, c := range login.Result().Cookies() {
		if c.Name == "reach_session" {
			return srv, db, c
		}
	}
	t.Fatal("missing reach_session cookie")
	return nil, nil, nil
}

func doReq(t *testing.T, srv *Server, cookie *http.Cookie, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	return rec
}

func createRun(t *testing.T, srv *Server, cookie *http.Cookie, payload string) string {
	t.Helper()
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", payload)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d %s", rec.Code, rec.Body.String())
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return out["run_id"].(string)
}

func TestAutonomousStatusLifecycle(t *testing.T) {
	srv, _, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie, `{"capabilities":["tool:echo"]}`)
	start := doReq(t, srv, cookie, http.MethodPost, "/v1/sessions/"+runID+"/autonomous/start", `{"goal":"ship","max_iterations":2,"max_runtime":2,"max_tool_calls":4,"burst_min_seconds":1,"burst_max_seconds":1,"sleep_seconds":1}`)
	if start.Code != http.StatusAccepted {
		t.Fatalf("start failed %d %s", start.Code, start.Body.String())
	}
	status := doReq(t, srv, cookie, http.MethodGet, "/v1/sessions/"+runID+"/autonomous/status", "")
	if status.Code != http.StatusOK {
		t.Fatalf("status failed %d", status.Code)
	}
}

func TestSpawnDepthEnforcement(t *testing.T) {
	srv, _, cookie := newAuthedServer(t)
	root := createRun(t, srv, cookie, `{"capabilities":["tool:echo"],"plan_tier":"free"}`)
	// Create child
	child := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"]}`)
	if child.Code != http.StatusCreated {
		t.Fatalf("expected child creation, got %d: %s", child.Code, child.Body.String())
	}
	var out map[string]any
	_ = json.Unmarshal(child.Body.Bytes(), &out)
	// Create grandchild - should fail due to free tier depth
	gchild := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+out["run_id"].(string)+"/spawn", `{"capabilities":["tool:echo"]}`)
	if gchild.Code != http.StatusForbidden {
		t.Fatalf("expected depth deny, got %d", gchild.Code)
	}
}

func TestNodeRegistryRoundTrip(t *testing.T) {
	srv, _, cookie := newAuthedServer(t)
	reg := doReq(t, srv, cookie, http.MethodPost, "/v1/nodes/register", `{"ID":"n1","Type":"local","Status":"online","Capabilities":["tool:echo"],"LatencyMS":10,"LoadScore":1}`)
	if reg.Code != http.StatusCreated {
		t.Fatalf("register failed: %d", reg.Code)
	}
	list := doReq(t, srv, cookie, http.MethodGet, "/v1/nodes", "")
	if list.Code != http.StatusOK {
		t.Fatalf("list failed: %d", list.Code)
	}
}

func TestGateDecisionRequiresTenantOwnership(t *testing.T) {
	srv, db, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie, `{}`)

	now := time.Now().UTC()
	err := db.PutSession(context.Background(), storage.SessionRecord{ID: "sess-other", TenantID: "other-tenant", UserID: "other-user", CreatedAt: now, ExpiresAt: now.Add(time.Hour)})
	if err != nil {
		t.Fatalf("failed to set other tenant session: %v", err)
	}
	otherCookie := &http.Cookie{Name: "reach_session", Value: "sess-other"}

	rec := doReq(t, srv, otherCookie, http.MethodPost, "/v1/runs/"+runID+"/gates/g1", `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected cross-tenant gate decision blocked, got %d", rec.Code)
	}
}

func TestMobileHandshakeRoundTrip(t *testing.T) {
	srv, _, cookie := newAuthedServer(t)
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("keygen failed: %v", err)
	}
	challengeRec := doReq(t, srv, cookie, http.MethodPost, "/v1/mobile/handshake/challenge", `{"node_id":"n1","org_id":"o1","public_key":"`+base64.StdEncoding.EncodeToString(pub)+`"}`)
	if challengeRec.Code != http.StatusOK {
		t.Fatalf("challenge failed: %d %s", challengeRec.Code, challengeRec.Body.String())
	}
	var challengeBody map[string]string
	_ = json.Unmarshal(challengeRec.Body.Bytes(), &challengeBody)
	challenge := challengeBody["challenge"]
	sig := ed25519.Sign(priv, []byte(challenge))
	completeRec := doReq(t, srv, cookie, http.MethodPost, "/v1/mobile/handshake/complete", `{"challenge":"`+challenge+`","signature":"`+base64.StdEncoding.EncodeToString(sig)+`"}`)
	if completeRec.Code != http.StatusOK {
		t.Fatalf("complete failed: %d %s", completeRec.Code, completeRec.Body.String())
	}
}

func TestMobileShareRoundTrip(t *testing.T) {
	srv, _, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie, `{}`)
	_ = doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+runID+"/tool-result", `{"tool_name":"echo","required_capabilities":[],"result":{"secret":"nope","value":"ok"}}`)
	shareRec := doReq(t, srv, cookie, http.MethodPost, "/v1/mobile/share-tokens", `{"run_id":"`+runID+`"}`)
	if shareRec.Code != http.StatusCreated {
		t.Fatalf("share create failed: %d %s", shareRec.Code, shareRec.Body.String())
	}
	var tokenBody map[string]string
	_ = json.Unmarshal(shareRec.Body.Bytes(), &tokenBody)
	fetchReq := httptest.NewRequest(http.MethodGet, "/v1/mobile/share/"+tokenBody["token"], nil)
	fetchRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(fetchRec, fetchReq)
	if fetchRec.Code != http.StatusOK {
		t.Fatalf("share fetch failed: %d %s", fetchRec.Code, fetchRec.Body.String())
	}
	if !bytes.Contains(fetchRec.Body.Bytes(), []byte("[REDACTED]")) {
		t.Fatalf("expected redacted payload in shared run: %s", fetchRec.Body.String())
	}
}

func TestReplaySnapshotMismatchIncrementsMetricThroughMetricsEndpoint(t *testing.T) {
	t.Setenv("RUNNER_METRICS_ENABLED", "1")
	srv, _, cookie := newAuthedServer(t)
	pack := registry.ExecutionPack{
		Metadata:            registry.PackMetadata{ID: "pack-a", Version: "1.0.0"},
		DeclaredTools:       []string{"tool.safe"},
		DeclaredPermissions: []string{},
		ModelRequirements:   map[string]string{"tier": "standard"},
		DeterministicFlag:   true,
	}
	hash, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = hash

	exec := autonomous.NewPackExecutor(passExecutor{}, pack).WithReplaySnapshotHash("snapshot-a").WithInvariantReporter(srv.metrics)

	res, err := exec.Execute(context.Background(), autonomous.ExecutionEnvelope{
		ID:       "env-1",
		ToolName: "tool.safe",
		Context: autonomous.ExecutionContext{
			IsReplay:             true,
			RegistrySnapshotHash: "snapshot-b",
		},
		Permissions: []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Error == nil || res.Error.Code != "REPLAY_SNAPSHOT_MISMATCH" {
		t.Fatalf("expected replay mismatch from pack executor, got %+v", res.Error)
	}

	metricsRec := doReq(t, srv, cookie, http.MethodGet, "/metrics", "")
	if metricsRec.Code != http.StatusOK {
		t.Fatalf("metrics endpoint failed: %d %s", metricsRec.Code, metricsRec.Body.String())
	}
	line := "reach_invariant_violations_total{name=\"replay_snapshot_hash_mismatch\"} 1"
	if !strings.Contains(metricsRec.Body.String(), line) {
		t.Fatalf("expected invariant violation metric line %q in output:\n%s", line, metricsRec.Body.String())
	}
}
