package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reach/services/integration-hub/internal/core"
)

func TestDispatchPropagatesCorrelationHeaders(t *testing.T) {
	t.Parallel()

	gotHeaders := http.Header{}
	gotBody := core.TriggerRequest{}
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeaders = r.Header.Clone()
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode trigger request: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer runner.Close()

	d := NewTriggerDispatcher(runner.URL)
	d.Client.Timeout = 2 * time.Second

	e := core.NormalizedEvent{
		TenantID:    "tenant-a",
		Provider:    "github",
		TriggerType: "webhook",
		Raw: map[string]any{
			"action": "opened",
		},
	}
	corr := Correlation{
		TraceID:   "0123456789abcdef0123456789abcdef",
		SessionID: "session-1",
		RunID:     "run-1",
		AgentID:   "agent-1",
		SpawnID:   "spawn-1",
		NodeID:    "node-1",
		RequestID: "request-1",
	}
	if err := d.Dispatch(t.Context(), e, corr); err != nil {
		t.Fatalf("dispatch: %v", err)
	}

	if gotHeaders.Get("traceparent") != "00-0123456789abcdef0123456789abcdef-0000000000000001-01" {
		t.Fatalf("traceparent header mismatch: %q", gotHeaders.Get("traceparent"))
	}
	if gotHeaders.Get("X-Session-ID") != "session-1" || gotHeaders.Get("X-Run-ID") != "run-1" || gotHeaders.Get("X-Agent-ID") != "agent-1" || gotHeaders.Get("X-Spawn-ID") != "spawn-1" || gotHeaders.Get("X-Node-ID") != "node-1" || gotHeaders.Get("X-Request-ID") != "request-1" {
		t.Fatalf("missing correlation headers: %#v", gotHeaders)
	}
	if gotBody.TenantID != "tenant-a" || gotBody.Source != "github" || gotBody.Type != "webhook" {
		t.Fatalf("bad trigger payload: %#v", gotBody)
	}
}

func TestDispatchOmitsEmptyCorrelationHeaders(t *testing.T) {
	t.Parallel()

	gotHeaders := http.Header{}
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusAccepted)
	}))
	defer runner.Close()

	d := NewTriggerDispatcher(runner.URL)
	d.Client.Timeout = 2 * time.Second
	e := core.NormalizedEvent{TenantID: "tenant-a", Provider: "github", TriggerType: "webhook", Raw: map[string]any{"action": "opened"}}

	if err := d.Dispatch(t.Context(), e, Correlation{}); err != nil {
		t.Fatalf("dispatch: %v", err)
	}

	if gotHeaders.Get("traceparent") != "" {
		t.Fatalf("traceparent should be omitted for empty correlation: %q", gotHeaders.Get("traceparent"))
	}
	for _, h := range []string{"X-Request-ID", "X-Session-ID", "X-Run-ID", "X-Agent-ID", "X-Spawn-ID", "X-Node-ID"} {
		if gotHeaders.Get(h) != "" {
			t.Fatalf("header %s should be omitted when correlation is empty, got %q", h, gotHeaders.Get(h))
		}
	}
}

func TestDispatchEmitsOnlyNonEmptyCorrelationHeaders(t *testing.T) {
	t.Parallel()

	gotHeaders := http.Header{}
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusAccepted)
	}))
	defer runner.Close()

	d := NewTriggerDispatcher(runner.URL)
	d.Client.Timeout = 2 * time.Second
	e := core.NormalizedEvent{TenantID: "tenant-a", Provider: "github", TriggerType: "webhook", Raw: map[string]any{"action": "opened"}}
	corr := Correlation{SessionID: "session-1", RequestID: "request-1"}

	if err := d.Dispatch(t.Context(), e, corr); err != nil {
		t.Fatalf("dispatch: %v", err)
	}

	if gotHeaders.Get("X-Session-ID") != "session-1" || gotHeaders.Get("X-Request-ID") != "request-1" {
		t.Fatalf("expected non-empty correlation headers to be set: %#v", gotHeaders)
	}
	if gotHeaders.Get("traceparent") != "" {
		t.Fatalf("traceparent should be omitted without trace id: %q", gotHeaders.Get("traceparent"))
	}
	for _, h := range []string{"X-Run-ID", "X-Agent-ID", "X-Spawn-ID", "X-Node-ID"} {
		if gotHeaders.Get(h) != "" {
			t.Fatalf("header %s should be omitted when corresponding correlation field is empty, got %q", h, gotHeaders.Get(h))
		}
	}
}
