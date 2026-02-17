package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"reach/services/runner/internal/storage"
)

func newAuthedServer(t *testing.T) (*Server, *http.Cookie) {
	t.Helper()
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	srv := NewServer(db)
	login := httptest.NewRecorder()
	srv.Handler().ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/auth/dev-login", bytes.NewBufferString(`{}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("dev login failed %d", login.Code)
	}
	return srv, login.Result().Cookies()[0]
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
	srv, cookie := newAuthedServer(t)
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
	srv, cookie := newAuthedServer(t)
	root := createRun(t, srv, cookie, `{"capabilities":["tool:echo"],"plan_tier":"free"}`)
	child := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"],"budget_slice":20}`)
	if child.Code != http.StatusCreated {
		t.Fatalf("expected child creation, got %d", child.Code)
	}
	var childOut map[string]any
	_ = json.Unmarshal(child.Body.Bytes(), &childOut)
	gchild := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+childOut["run_id"].(string)+"/spawn", `{"capabilities":["tool:echo"],"budget_slice":10}`)
	if gchild.Code != http.StatusForbidden {
		t.Fatalf("expected depth guardrail deny, got %d", gchild.Code)
	}
}

func TestCapabilityNarrowingAndBudgetSlicing(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	root := createRun(t, srv, cookie, `{"capabilities":["tool:echo","tool:safe"],"plan_tier":"pro"}`)

	denyCap := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:danger"],"budget_slice":10}`)
	if denyCap.Code != http.StatusForbidden {
		t.Fatalf("expected capability deny, got %d", denyCap.Code)
	}
	denyBudget := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"],"budget_slice":101}`)
	if denyBudget.Code != http.StatusForbidden {
		t.Fatalf("expected budget deny, got %d", denyBudget.Code)
	}
	ok := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"],"budget_slice":30,"ttl_seconds":1}`)
	if ok.Code != http.StatusCreated {
		t.Fatalf("expected successful spawn, got %d body=%s", ok.Code, ok.Body.String())
	}
}

func TestFreeTierRestrictsHostedNodeRouting(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	_ = doReq(t, srv, cookie, http.MethodPost, "/v1/nodes/register", `{"id":"hosted-1","type":"hosted","capabilities":["tool:echo"],"current_load":0,"latency_ms":1,"status":"online"}`)
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", `{"capabilities":["tool:echo"],"plan_tier":"free"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d", rec.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if selected, _ := out["node_selected"].(bool); selected {
		t.Fatalf("free tier should not route to hosted node")
	}
}

func TestBYOKFlowAndNoKeyLogging(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", `{"capabilities":["tool:echo"],"plan_tier":"pro","provider":{"provider_type":"openai","api_key":"sk-secret","endpoint":"https://api.openai.com"}}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d", rec.Code)
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("sk-secret")) {
		t.Fatal("api key leaked in response")
	}

	localOnly := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", `{"capabilities":["tool:echo"],"plan_tier":"pro","provider":{"provider_type":"openai","endpoint":"https://api.openai.com"}}`)
	var out map[string]any
	_ = json.Unmarshal(localOnly.Body.Bytes(), &out)
	if local, _ := out["local_only"].(bool); !local {
		t.Fatalf("expected local-only mode when key missing")
	}
}

func TestPlanUpgradeEnablesHostedFeatures(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	_ = doReq(t, srv, cookie, http.MethodPost, "/v1/nodes/register", `{"id":"hosted-1","type":"hosted","capabilities":["tool:echo"],"current_load":0,"latency_ms":1,"status":"online"}`)
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", `{"capabilities":["tool:echo"],"plan_tier":"pro","provider":{"provider_type":"openai","api_key":"x","endpoint":"https://api"}}`)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if selected, _ := out["node_selected"].(bool); !selected {
		t.Fatalf("expected hosted routing for pro tier with key")
	}
}

func TestChildExpirationTimer(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	root := createRun(t, srv, cookie, `{"capabilities":["tool:echo"],"plan_tier":"pro"}`)
	child := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"],"budget_slice":5,"ttl_seconds":1}`)
	if child.Code != http.StatusCreated {
		t.Fatalf("spawn failed: %d", child.Code)
	}
	time.Sleep(1200 * time.Millisecond)
	var out map[string]any
	_ = json.Unmarshal(child.Body.Bytes(), &out)
	events := doReq(t, srv, cookie, http.MethodGet, "/v1/runs/"+out["run_id"].(string)+"/events", "")
	if !bytes.Contains(events.Body.Bytes(), []byte("spawn.expired")) {
		t.Fatalf("expected expiration event, got %s", events.Body.String())
	}
}
