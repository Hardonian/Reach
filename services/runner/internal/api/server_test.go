package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

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
	srv.Handler().ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/auth/dev-login", nil))
	if login.Code != http.StatusOK {
		t.Fatalf("login failed: %d", login.Code)
	}
	return srv, login.Result().Cookies()[0]
}

func TestNodeSelectionDeterministic(t *testing.T) {
	srv, cookie := newAuthedServer(t)

	for _, payload := range []string{
		`{"id":"node-b","type":"worker","capabilities":["tool:echo"],"current_load":1,"latency_ms":40,"status":"online"}`,
		`{"id":"node-a","type":"worker","capabilities":["tool:echo"],"current_load":1,"latency_ms":40,"status":"online"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/v1/nodes/register", bytes.NewBufferString(payload))
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("register failed: %d", rec.Code)
		}
	}

	createReq := httptest.NewRequest(http.MethodPost, "/v1/runs", bytes.NewBufferString(`{"capabilities":["tool:echo"]}`))
	createReq.AddCookie(cookie)
	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d body=%s", createRec.Code, createRec.Body.String())
	}
	var out map[string]any
	_ = json.Unmarshal(createRec.Body.Bytes(), &out)
	runID := out["run_id"].(string)

	eventsReq := httptest.NewRequest(http.MethodGet, "/v1/runs/"+runID+"/events", nil)
	eventsReq.AddCookie(cookie)
	eventsRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(eventsRec, eventsReq)
	if eventsRec.Code != http.StatusOK {
		t.Fatalf("events failed: %d", eventsRec.Code)
	}
	if !bytes.Contains(eventsRec.Body.Bytes(), []byte(`bm9kZS1h`)) {
		t.Fatalf("expected deterministic node-a selection: %s", eventsRec.Body.String())
	}
}

func TestTenantIsolation(t *testing.T) {
	db, _ := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	defer db.Close()
	srv := NewServer(db)

	mkSession := func(tenant string) *http.Cookie {
		rec := httptest.NewRecorder()
		srv.setSession(rec, httptest.NewRequest(http.MethodGet, "/", nil).Context(), tenant, tenant)
		return rec.Result().Cookies()[0]
	}
	cA := mkSession("tenant-a")
	cB := mkSession("tenant-b")

	createReq := httptest.NewRequest(http.MethodPost, "/v1/runs", bytes.NewBufferString(`{"capabilities":[]}`))
	createReq.AddCookie(cA)
	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, createReq)
	var out map[string]string
	_ = json.Unmarshal(createRec.Body.Bytes(), &out)

	otherReq := httptest.NewRequest(http.MethodGet, "/v1/runs/"+out["run_id"]+"/events", nil)
	otherReq.AddCookie(cB)
	otherRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(otherRec, otherReq)
	if otherRec.Code != http.StatusNotFound {
		t.Fatalf("expected tenant isolation 404 got %d", otherRec.Code)
	}
}
