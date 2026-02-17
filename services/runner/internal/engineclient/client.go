package engineclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type Client struct {
	bin string
}

func New(bin string) *Client {
	if bin == "" {
		bin = os.Getenv("ENGINE_JSON_BIN")
	}
	if bin == "" {
		bin = "engine-json"
	}
	return &Client{bin: bin}
}

type Event struct {
	SchemaVersion string          `json:"schemaVersion"`
	EventID       string          `json:"eventId"`
	RunID         string          `json:"runId"`
	Type          string          `json:"type"`
	Timestamp     string          `json:"timestamp"`
	Payload       json.RawMessage `json:"payload"`
}

type Action struct {
	Type string `json:"type"`

	ToolCall *struct {
		StepID   string          `json:"step_id"`
		ToolName string          `json:"tool_name"`
		Input    json.RawMessage `json:"input"`
	} `json:"ToolCall,omitempty"`
}

type Response struct {
	OK        bool            `json:"ok"`
	Workflow  json.RawMessage `json:"workflow,omitempty"`
	RunHandle json.RawMessage `json:"run_handle,omitempty"`
	Events    []Event         `json:"events"`
	Action    json.RawMessage `json:"action,omitempty"`
	Error     string          `json:"error,omitempty"`
}

type ToolResult struct {
	StepID   string          `json:"step_id"`
	ToolName string          `json:"tool_name"`
	Output   json.RawMessage `json:"output"`
	Success  bool            `json:"success"`
	Error    *string         `json:"error"`
}

func (c *Client) CompileWorkflow(ctx context.Context, workflow json.RawMessage) (json.RawMessage, error) {
	resp, err := c.call(ctx, map[string]any{"command": "compile_workflow", "workflow_json": json.RawMessage(workflow)})
	if err != nil {
		return nil, err
	}
	return resp.Workflow, nil
}

func (c *Client) StartRun(ctx context.Context, runID string, workflow json.RawMessage, initiator string) (json.RawMessage, []Event, error) {
	resp, err := c.call(ctx, map[string]any{"command": "start_run", "run_id": runID, "workflow": json.RawMessage(workflow), "initiator": initiator})
	if err != nil {
		return nil, nil, err
	}
	return resp.RunHandle, resp.Events, nil
}

func (c *Client) NextAction(ctx context.Context, runID string, runHandle json.RawMessage) (json.RawMessage, []Event, json.RawMessage, error) {
	resp, err := c.call(ctx, map[string]any{"command": "next_action", "run_id": runID, "run_handle": json.RawMessage(runHandle)})
	if err != nil {
		return nil, nil, nil, err
	}
	return resp.RunHandle, resp.Events, resp.Action, nil
}

func (c *Client) ApplyToolResult(ctx context.Context, runID string, runHandle json.RawMessage, toolResult ToolResult) (json.RawMessage, []Event, error) {
	resp, err := c.call(ctx, map[string]any{"command": "apply_tool_result", "run_id": runID, "run_handle": json.RawMessage(runHandle), "tool_result": toolResult})
	if err != nil {
		return nil, nil, err
	}
	return resp.RunHandle, resp.Events, nil
}

func (c *Client) call(ctx context.Context, req any) (*Response, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	var cmd *exec.Cmd
	if c.bin == "engine-json" {
		root, rootErr := repoRoot()
		if rootErr != nil {
			return nil, rootErr
		}
		cmd = exec.CommandContext(ctx, "cargo", "run", "-p", "engine", "--bin", "engine-json", "--quiet", "--")
		cmd.Dir = root
	} else {
		cmd = exec.CommandContext(ctx, c.bin)
	}
	cmd.Stdin = bytes.NewReader(payload)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("engine command failed: %w stderr=%s", err, stderr.String())
	}

	var resp Response
	if err := json.Unmarshal(stdout.Bytes(), &resp); err != nil {
		return nil, fmt.Errorf("invalid engine response: %w", err)
	}
	if !resp.OK {
		if resp.Error == "" {
			resp.Error = "unknown engine error"
		}
		return nil, errors.New(resp.Error)
	}
	return &resp, nil
}

func repoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, statErr := os.Stat(filepath.Join(wd, "Cargo.toml")); statErr == nil {
			return wd, nil
		}
		next := filepath.Dir(wd)
		if next == wd {
			return "", errors.New("repo root with Cargo.toml not found")
		}
		wd = next
	}
}
