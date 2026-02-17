package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"reach/services/runner/internal/jobs"
)

func installFakeEngineJSON(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "engine-json")
	script := `#!/usr/bin/env python3
import json,sys
req=json.load(sys.stdin)
cmd=req["command"]
run_id=req.get("run_id","")
if cmd=="compile_workflow":
    print(json.dumps({"ok":True,"workflow":req["workflow_json"],"events":[]}))
elif cmd=="start_run":
    handle={"step":0}
    evt={"schemaVersion":"0.1.0","eventId":run_id+"-evt-0","runId":run_id,"type":"run.started","timestamp":"1970-01-01T00:00:00Z","payload":{"schemaVersion":"0.1.0","initiator":req.get("initiator","runner")}}
    print(json.dumps({"ok":True,"run_handle":handle,"events":[evt]}))
elif cmd=="next_action":
    handle=req["run_handle"]
    if handle.get("step",0)==0:
      handle["step"]=1
      evt={"schemaVersion":"0.1.0","eventId":run_id+"-evt-1","runId":run_id,"type":"tool.call","timestamp":"1970-01-01T00:00:00Z","payload":{"schemaVersion":"0.1.0","callId":"call-1","toolName":"echo","input":{"message":"ping"}}}
      action={"type":"tool_call","step_id":"call-1","tool_name":"echo","input":{"message":"ping"}}
      print(json.dumps({"ok":True,"run_handle":handle,"events":[evt],"action":action}))
    else:
      evt={"schemaVersion":"0.1.0","eventId":run_id+"-evt-2","runId":run_id,"type":"run.completed","timestamp":"1970-01-01T00:00:00Z","payload":{"schemaVersion":"0.1.0","status":"succeeded"}}
      action={"type":"done"}
      print(json.dumps({"ok":True,"run_handle":handle,"events":[evt],"action":action}))
elif cmd=="apply_tool_result":
    handle=req["run_handle"]
    handle["step"]=2
    tr=req["tool_result"]
    evt={"schemaVersion":"0.1.0","eventId":run_id+"-evt-1","runId":run_id,"type":"tool.result","timestamp":"1970-01-01T00:00:00Z","payload":{"schemaVersion":"0.1.0","callId":tr["step_id"],"status":"ok","output":tr.get("output",{})}}
    print(json.dumps({"ok":True,"run_handle":handle,"events":[evt]}))
else:
    print(json.dumps({"ok":False,"error":"unknown command"}))
`
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatalf("write fake engine json: %v", err)
	}
	return path
}

func TestCreateRun(t *testing.T) {
	fake := installFakeEngineJSON(t)
	t.Setenv("ENGINE_JSON_BIN", fake)

	srv := NewServer(jobs.NewStore())
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/runs", strings.NewReader(`{"capabilities":["tool:echo"]}`))

	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected %d got %d body=%s", http.StatusCreated, rec.Code, rec.Body.String())
	}

	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["run_id"] != "run-000001" {
		t.Fatalf("unexpected run id: %s", payload["run_id"])
	}
	if payload["request_id"] == "" {
		t.Fatal("expected request id")
	}
}

func TestEventStreamDeterministicProgression(t *testing.T) {
	fake := installFakeEngineJSON(t)
	t.Setenv("ENGINE_JSON_BIN", fake)

	store := jobs.NewStore()
	srv := NewServer(store)

	workflow := `{"id":"wf-test","version":"0.1.0","steps":[{"id":"call-1","kind":{"type":"tool_call","tool":{"name":"echo","description":"Echo input","input_schema":{"type":"object"},"output_schema":{"type":"object"}},"input":{"message":"ping"}}}]}`
	createBody := bytes.NewBufferString(`{"workflow":` + workflow + `,"initiator":"tests"}`)
	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, httptest.NewRequest(http.MethodPost, "/v1/runs", createBody))
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create run failed: %d %s", createRec.Code, createRec.Body.String())
	}
	var created map[string]string
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)
	runID := created["run_id"]

	body := bytes.NewBufferString(`{"tool_name":"echo","required_capabilities":["tool:echo"],"result":{"output":"ok"}}`)
	toolReq := httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/tool-result", body)
	toolRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(toolRec, toolReq)
	if toolRec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", toolRec.Code)
	}

	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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
	seenRunStarted := false
	seenToolCall := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: heartbeat") {
			seenHeartbeat = true
		}
		if strings.HasPrefix(line, "data: ") {
			var evt struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &evt); err == nil {
				if evt.Type == "run.started" {
					seenRunStarted = true
				}
				if evt.Type == "tool.call" {
					seenToolCall = true
					break
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scanner err: %v", err)
	}
	if !seenHeartbeat {
		t.Fatal("expected heartbeat event")
	}
	if !seenRunStarted {
		t.Fatal("expected run.started event")
	}
	if !seenToolCall {
		t.Fatal("expected tool.call event")
	}

	toolBody := bytes.NewBufferString(`{"step_id":"call-1","tool_name":"echo","output":{"message":"pong"},"success":true,"error":null}`)
	toolReq := httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/tool-result", toolBody)
	toolRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(toolRec, toolReq)
	if toolRec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d body=%s", toolRec.Code, toolRec.Body.String())
	}
}

func TestToolResultForbiddenWhenCapabilityMissing(t *testing.T) {
	store := jobs.NewStore(jobs.NewFileAuditLogger(t.TempDir()))
	srv := NewServer(store)

	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, httptest.NewRequest(http.MethodPost, "/v1/runs", strings.NewReader(`{"capabilities":["tool:safe"]}`)))
	var created map[string]string
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)
	runID := created["run_id"]

	body := bytes.NewBufferString(`{"tool_name":"danger","required_capabilities":["tool:danger"],"result":{"output":"ok"}}`)
	toolReq := httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/tool-result", body)
	toolRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(toolRec, toolReq)
	if toolRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 got %d", toolRec.Code)
	}
}

func TestGetAudit(t *testing.T) {
	store := jobs.NewStore(jobs.NewFileAuditLogger(t.TempDir()))
	srv := NewServer(store)

	createRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(createRec, httptest.NewRequest(http.MethodPost, "/v1/runs", strings.NewReader(`{"capabilities":["tool:echo"]}`)))
	var created map[string]string
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)
	runID := created["run_id"]

	toolBody := bytes.NewBufferString(`{"tool_name":"echo","required_capabilities":["tool:echo"],"result":{"output":"ok"}}`)
	toolRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(toolRec, httptest.NewRequest(http.MethodPost, "/v1/runs/"+runID+"/tool-result", toolBody))

	auditRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(auditRec, httptest.NewRequest(http.MethodGet, "/v1/runs/"+runID+"/audit", nil))
	if auditRec.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", auditRec.Code)
	}

	var payload struct {
		Entries []jobs.AuditEntry `json:"entries"`
	}
	if err := json.Unmarshal(auditRec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode audit response: %v", err)
	}
	if len(payload.Entries) < 4 {
		t.Fatalf("expected multiple audit entries, got %d", len(payload.Entries))
	}
}
