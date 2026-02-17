package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"reach/services/runner/internal/storage"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	db, err := storage.NewSQLiteStore(t.TempDir() + "/runner.sqlite")
	if err != nil {
		t.Fatal(err)
	}
	return NewServer(db)
}

func TestDevLoginCreateRunAndResumeEvents(t *testing.T) {
	srv := newTestServer(t)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	client := &http.Client{}
	loginReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/auth/dev-login", nil)
	loginResp, err := client.Do(loginReq)
	if err != nil {
		t.Fatal(err)
	}
	cookie := loginResp.Cookies()[0]

	createReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/runs", strings.NewReader(`{"capabilities":["tool:echo"]}`))
	createReq.AddCookie(cookie)
	createResp, err := client.Do(createReq)
	if err != nil {
		t.Fatal(err)
	}
	var created map[string]string
	_ = json.NewDecoder(createResp.Body).Decode(&created)
	runID := created["run_id"]

	toolReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/runs/"+runID+"/tool-result", bytes.NewBufferString(`{"tool_name":"echo","required_capabilities":["tool:echo"],"result":{"ok":true}}`))
	toolReq.AddCookie(cookie)
	if resp, err := client.Do(toolReq); err != nil || resp.StatusCode != 200 {
		t.Fatalf("tool result failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	streamReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+"/v1/runs/"+runID+"/events", nil)
	streamReq.AddCookie(cookie)
	streamReq.Header.Set("Last-Event-ID", "0")
	streamResp, err := client.Do(streamReq)
	if err != nil {
		t.Fatal(err)
	}
	scanner := bufio.NewScanner(streamResp.Body)
	found := false
	for scanner.Scan() {
		if strings.Contains(scanner.Text(), "tool.result") {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected tool.result in stream")
	}
}
