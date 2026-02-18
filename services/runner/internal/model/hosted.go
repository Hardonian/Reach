package model

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HostedAdapter connects to cloud LLM APIs (OpenAI, Anthropic, Google, etc).
type HostedAdapter struct {
	name         string
	endpoint     string
	apiKey       string
	modelID      string
	client       *http.Client
	capabilities ModelCapabilities
}

// HostedConfig configures the hosted adapter.
type HostedConfig struct {
	Name         string
	Endpoint     string
	APIKey       string
	ModelID      string
	TimeoutSec   int
	Capabilities ModelCapabilities
}

// NewHostedAdapter creates a cloud LLM adapter.
func NewHostedAdapter(cfg HostedConfig) *HostedAdapter {
	timeout := cfg.TimeoutSec
	if timeout == 0 {
		timeout = 60
	}
	
	return &HostedAdapter{
		name:         cfg.Name,
		endpoint:     cfg.Endpoint,
		apiKey:       cfg.APIKey,
		modelID:      cfg.ModelID,
		client:       &http.Client{Timeout: time.Duration(timeout) * time.Second},
		capabilities: cfg.Capabilities,
	}
}

// Name returns the adapter identifier.
func (a *HostedAdapter) Name() string {
	return a.name
}

// Capabilities describes model capabilities.
func (a *HostedAdapter) Capabilities() ModelCapabilities {
	return a.capabilities
}

// Generate calls the hosted API.
func (a *HostedAdapter) Generate(ctx context.Context, input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
	reqBody, err := a.buildRequest(input, opts)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", a.endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	
	return a.parseResponse(resp.Body)
}

// Available checks if the API is reachable.
func (a *HostedAdapter) Available(ctx context.Context) bool {
	// Simple health check - try to reach the endpoint
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "GET", a.endpoint, nil)
	if err != nil {
		return false
	}
	
	resp, err := a.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	
	return resp.StatusCode < 500
}

// Health returns detailed health status.
func (a *HostedAdapter) Health(ctx context.Context) HealthStatus {
	start := time.Now()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	
	status := HealthStatus{LastChecked: time.Now().Unix()}
	
	req, err := http.NewRequestWithContext(ctx, "GET", a.endpoint, nil)
	if err != nil {
		status.Errors = append(status.Errors, err.Error())
		return status
	}
	
	resp, err := a.client.Do(req)
	if err != nil {
		status.Errors = append(status.Errors, err.Error())
		return status
	}
	defer resp.Body.Close()
	
	status.LatencyMs = int(time.Since(start).Milliseconds())
	status.Healthy = resp.StatusCode < 500
	
	if !status.Healthy {
		status.Errors = append(status.Errors, fmt.Sprintf("HTTP %d", resp.StatusCode))
	}
	
	return status
}

func (a *HostedAdapter) buildRequest(input GenerateInput, opts GenerateOptions) ([]byte, error) {
	// OpenAI-compatible format
	req := map[string]any{
		"model": a.modelID,
		"messages": a.convertMessages(input.Messages),
	}
	
	if opts.Temperature > 0 {
		req["temperature"] = opts.Temperature
	}
	if opts.MaxTokens > 0 {
		req["max_tokens"] = opts.MaxTokens
	}
	if opts.TopP > 0 {
		req["top_p"] = opts.TopP
	}
	if opts.StopSequences != nil {
		req["stop"] = opts.StopSequences
	}
	if opts.Tools != nil {
		req["tools"] = a.convertTools(opts.Tools)
	}
	if opts.RequireJSON {
		req["response_format"] = map[string]string{"type": "json_object"}
	}
	
	return json.Marshal(req)
}

func (a *HostedAdapter) convertMessages(msgs []Message) []map[string]string {
	result := make([]map[string]string, len(msgs))
	for i, m := range msgs {
		result[i] = map[string]string{
			"role":    m.Role,
			"content": m.Content,
		}
	}
	return result
}

func (a *HostedAdapter) convertTools(tools []ToolDefinition) []map[string]any {
	result := make([]map[string]any, len(tools))
	for i, t := range tools {
		result[i] = map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        t.Name,
				"description": t.Description,
				"parameters":  json.RawMessage(t.Parameters),
			},
		}
	}
	return result
}

func (a *HostedAdapter) parseResponse(body io.Reader) (*ModelOutput, error) {
	var resp struct {
		Choices []struct {
			Message struct {
				Content   string     `json:"content"`
				ToolCalls []ToolCall `json:"tool_calls"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	
	choice := resp.Choices[0]
	return &ModelOutput{
		Content:      choice.Message.Content,
		ToolCalls:    choice.Message.ToolCalls,
		FinishReason: choice.FinishReason,
		Usage: TokenUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}, nil
}
