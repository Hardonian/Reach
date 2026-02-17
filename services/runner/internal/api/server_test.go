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
	srv := NewServer(db, "test")
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

func TestSpawnDepthEnforcement(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	root := createRun(t, srv, cookie, `{"capabilities":["tool:echo"],"plan_tier":"free"}`)
	child := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+root+"/spawn", `{"capabilities":["tool:echo"]}`)
	if child.Code != http.StatusCreated {
		t.Fatalf("expected child creation, got %d", child.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(child.Body.Bytes(), &out)
	gchild := doReq(t, srv, cookie, http.MethodPost, "/v1/runs/"+out["run_id"].(string)+"/spawn", `{"capabilities":["tool:echo"]}`)
	if gchild.Code != http.StatusForbidden {
		t.Fatalf("expected depth deny, got %d", gchild.Code)
	}
}

func TestNodeRegistryRoundTrip(t *testing.T) {
	srv, cookie := newAuthedServer(t)
	reg := doReq(t, srv, cookie, http.MethodPost, "/v1/nodes/register", `{"ID":"n1","Type":"local","Status":"online","Capabilities":["tool:echo"],"LatencyMS":10,"LoadScore":1}`)
	if reg.Code != http.StatusCreated {
		t.Fatalf("register failed: %d", reg.Code)
	}
	list := doReq(t, srv, cookie, http.MethodGet, "/v1/nodes", "")
	if list.Code != http.StatusOK {
		t.Fatalf("list failed: %d", list.Code)
	}
}
