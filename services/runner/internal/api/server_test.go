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

	"reach/services/runner/internal/jobs"
)

func TestCreateRun(t *testing.T) {
	srv := NewServer(jobs.NewStore())
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/runs", nil)

	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected %d got %d", http.StatusCreated, rec.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["run_id"] != "run-000001" {
		t.Fatalf("unexpected run id: %s", payload["run_id"])
	}
}

func TestToolResultAndSSE(t *testing.T) {
	store := jobs.NewStore()
	srv := NewServer(store)

	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, httptest.NewRequest(http.MethodPost, "/v1/runs", nil))
	var created map[string]string
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)
	runID := created["run_id"]

	body := bytes.NewBufferString(`{"tool":"echo","output":"ok"}`)
	toolReq := httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/tool-result", body)
	toolRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(toolRec, toolReq)
	if toolRec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", toolRec.Code)
	}

	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+"/v1/runs/"+runID+"/events", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("stream request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 got %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	seenHeartbeat := false
	seenToolEvent := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: heartbeat") {
			seenHeartbeat = true
		}
		if strings.HasPrefix(line, "event: tool.result") {
			seenToolEvent = true
			break
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scanner err: %v", err)
	}
	if !seenHeartbeat {
		t.Fatal("expected heartbeat event")
	}
	if !seenToolEvent {
		t.Fatal("expected tool.result event")
	}
}
