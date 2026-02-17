package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/storage"
)

func newAuthedServer(t *testing.T) (*Server, *http.Cookie) {
	t.Helper()
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	srv := NewServer(db)
	login := httptest.NewRecorder()
	srv.Handler().ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/auth/dev-login", bytes.NewBufferString(`{}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("dev login failed %d", login.Code)
	}
	cookies := login.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}
	return srv, cookies[0]
}

func doReq(t *testing.T, srv *Server, cookie *http.Cookie, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.AddCookie(&http.Cookie{Name: cookie.Name, Value: cookie.Value, Path: "/"})
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	return rec
}

func createRun(t *testing.T, srv *Server, cookie *http.Cookie) string {
	t.Helper()
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs", `{"capabilities":["tool:safe"]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d %s", rec.Code, rec.Body.String())
	}
	var out map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return out["run_id"]
}

func TestGateRequestedWhenCapabilityDenied(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie)
	rec := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+runID+"/tool-result", `{"tool_name":"danger","required_capabilities":["tool:danger"],"result":{}}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 got %d", rec.Code)
	}
}

func TestExportImportCapsule(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie)
	_ = srv.store.PublishEvent(t.Context(), runID, jobs.Event{Type: "run.completed", Payload: []byte(`{"type":"run_completed"}`), CreatedAt: time.Now().UTC()}, "test")

	exp := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+runID+"/export", "")
	if exp.Code != http.StatusOK {
		t.Fatalf("export failed: %d", exp.Code)
	}
	zr, err := zip.NewReader(bytes.NewReader(exp.Body.Bytes()), int64(exp.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, f := range zr.File {
		if f.Name == "events.ndjson" {
			found = true
		}
	}
	if !found {
		t.Fatal("events.ndjson missing")
	}

	imp := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/import", exp.Body.String())
	if imp.Code != http.StatusCreated {
		t.Fatalf("import failed: %d body=%s", imp.Code, imp.Body.String())
	}
}

func TestAutonomousStatusLifecycle(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	runID := createRun(t, srv, cookie)
	start := doReq(t, srv, cookie, http.MethodPost, "/v1/sessions/"+runID+"/autonomous/start", `{"goal":"ship","max_iterations":2,"max_runtime":2,"max_tool_calls":4}`)
	if start.Code != http.StatusAccepted {
		t.Fatalf("start failed %d %s", start.Code, start.Body.String())
	}
	status := doReq(t, srv, cookie, http.MethodGet, "/v1/sessions/"+runID+"/autonomous/status", "")
	if status.Code != http.StatusOK {
		t.Fatalf("status failed %d", status.Code)
	}
	stop := doReq(t, srv, cookie, http.MethodPost, "/v1/sessions/"+runID+"/autonomous/stop", "")
	if stop.Code != http.StatusOK {
		t.Fatalf("stop failed %d", stop.Code)
	}
}

func TestPluginsEndpoint(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	rec := doReq(t, srv, cookie, http.MethodGet, "/v1/plugins", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rec.Code)
	}
	b, _ := io.ReadAll(rec.Body)
	if !bytes.Contains(b, []byte("plugins")) {
		t.Fatalf("expected plugins payload in %s", string(b))
	}
}
