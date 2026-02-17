package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"reach/services/runner/internal/jobs"
)

func TestGateRequestedWhenCapabilityDenied(t *testing.T) {
	store := jobs.NewStore(jobs.NewFileAuditLogger(t.TempDir()))
	srv := NewServer(store)

	create := httptest.NewRecorder()
	srv.Handler().ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/v1/runs", bytes.NewBufferString(`{"capabilities":["tool:safe"]}`)))
	var out map[string]string
	_ = json.Unmarshal(create.Body.Bytes(), &out)

	req := httptest.NewRequest(http.MethodPost, "/v1/runs/"+out["run_id"]+"/tool-result", bytes.NewBufferString(`{"tool_name":"danger","required_capabilities":["tool:danger"],"result":{}}`))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 got %d", rec.Code)
	}
}

func TestExportImportCapsule(t *testing.T) {
	store := jobs.NewStore(jobs.NewFileAuditLogger(t.TempDir()))
	srv := NewServer(store)

	create := httptest.NewRecorder()
	srv.Handler().ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/v1/runs", bytes.NewBufferString(`{"capabilities":[]}`)))
	var out map[string]string
	_ = json.Unmarshal(create.Body.Bytes(), &out)
	runID := out["run_id"]
	_ = store.PublishEvent(runID, jobs.Event{Type: "run.completed", Payload: []byte(`{"type":"run_completed"}`)}, "test")

	exp := httptest.NewRecorder()
	srv.Handler().ServeHTTP(exp, httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/export", nil))
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

	imp := httptest.NewRecorder()
	srv.Handler().ServeHTTP(imp, httptest.NewRequest(http.MethodPost, "/v1/runs/import", bytes.NewReader(exp.Body.Bytes())))
	if imp.Code != http.StatusCreated {
		t.Fatalf("import failed: %d body=%s", imp.Code, imp.Body.String())
	}
}

func TestPluginsEndpoint(t *testing.T) {
	root := filepath.Join("..", "plugins", "sample")
	_ = os.MkdirAll(root, 0o755)
	_ = os.WriteFile(filepath.Join(root, "manifest.json"), []byte(`{"id":"sample","name":"Sample","version":"1.0.0","tools":[{"name":"sample.echo","required_capabilities":["tool:echo"]}]}`), 0o644)
	defer os.RemoveAll(filepath.Join("..", "plugins"))

	srv := NewServer(jobs.NewStore())
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/plugins", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rec.Code)
	}
	b, _ := io.ReadAll(rec.Body)
	if !bytes.Contains(b, []byte("sample")) {
		t.Fatalf("expected sample plugin in %s", string(b))
	}
}
