package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reach/services/runner/internal/storage"
	"testing"
	"time"
)

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
		t.Fatalf("expected child creation, got %d", child.Code)
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
