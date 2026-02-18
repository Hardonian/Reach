package model

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"
)

// LocalAdapter connects to local LLM servers (Ollama, llama.cpp, etc).
type LocalAdapter struct {
	name         string
	endpoint     string
	modelID      string
	client       *http.Client
	capabilities ModelCapabilities
}

// LocalConfig configures the local adapter.
type LocalConfig struct {
	Name         string
	Endpoint     string // e.g., "http://localhost:11434"
	ModelID      string // e.g., "llama3.2:3b"
	TimeoutSec   int
	Capabilities ModelCapabilities
}

// NewLocalAdapter creates a local LLM adapter.
func NewLocalAdapter(cfg LocalConfig) *LocalAdapter {
	timeout := cfg.TimeoutSec
	if timeout == 0 {
		timeout = 120 // Local models may be slower
	}
	
	return &LocalAdapter{
		name:         cfg.Name,
		endpoint:     cfg.Endpoint,
		modelID:      cfg.ModelID,
		client:       &http.Client{Timeout: time.Duration(timeout) * time.Second},
		capabilities: cfg.Capabilities,
	}
}

// Name returns the adapter identifier.
func (a *LocalAdapter) Name() string {
	return a.name
}

// Capabilities describes model capabilities.
func (a *LocalAdapter) Capabilities() ModelCapabilities {
	return a.capabilities
}

// Generate calls the local API (Ollama-compatible format).
func (a *LocalAdapter) Generate(ctx context.Context, input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
	reqBody, err := a.buildRequest(input, opts)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	
	url := fmt.Sprintf("%s/api/generate", a.endpoint)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
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

// Available checks if the local server is running.
func (a *LocalAdapter) Available(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	
	url := fmt.Sprintf("%s/api/tags", a.endpoint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}
	
	resp, err := a.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return false
	}
	
	// Check if model is available
	return a.modelAvailable(resp.Body)
}

// Health returns detailed health status.
func (a *LocalAdapter) Health(ctx context.Context) HealthStatus {
	start := time.Now()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	status := HealthStatus{LastChecked: time.Now().Unix()}
	
	url := fmt.Sprintf("%s/api/tags", a.endpoint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
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
	status.Healthy = resp.StatusCode == http.StatusOK && a.modelAvailable(resp.Body)
	
	if !status.Healthy {
		status.Errors = append(status.Errors, "model not available")
	}
	
	return status
}

func (a *LocalAdapter) modelAvailable(body io.Reader) bool {
	var tags struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(body).Decode(&tags); err != nil {
		return false
	}
	for _, m := range tags.Models {
		if m.Name == a.modelID {
			return true
		}
	}
	return false
}

func (a *LocalAdapter) buildRequest(input GenerateInput, opts GenerateOptions) ([]byte, error) {
	// Build prompt from messages
	prompt := a.buildPrompt(input.Messages)
	
	req := map[string]any{
		"model":  a.modelID,
		"prompt": prompt,
		"stream": false,
	}
	
	if opts.Temperature > 0 {
		req["options"] = map[string]any{
			"temperature": opts.Temperature,
		}
	}
	if opts.TopK > 0 {
		if req["options"] == nil {
			req["options"] = make(map[string]any)
		}
		req["options"].(map[string]any)["top_k"] = opts.TopK
	}
	if opts.TopP > 0 {
		if req["options"] == nil {
			req["options"] = make(map[string]any)
		}
		req["options"].(map[string]any)["top_p"] = opts.TopP
	}
	if opts.StopSequences != nil {
		req["options"].(map[string]any)["stop"] = opts.StopSequences
	}
	
	return json.Marshal(req)
}

func (a *LocalAdapter) buildPrompt(msgs []Message) string {
	// Simple prompt concatenation for local models
	var prompt string
	for _, m := range msgs {
		switch m.Role {
		case "system":
			prompt += fmt.Sprintf("System: %s\n\n", m.Content)
		case "user":
			prompt += fmt.Sprintf("User: %s\n", m.Content)
		case "assistant":
			prompt += fmt.Sprintf("Assistant: %s\n", m.Content)
		}
	}
	prompt += "Assistant: "
	return prompt
}

func (a *LocalAdapter) parseResponse(body io.Reader) (*ModelOutput, error) {
	var resp struct {
		Response    string `json:"response"`
		Done        bool   `json:"done"`
		TotalDuration int64 `json:"total_duration"`
		EvalCount   int    `json:"eval_count"`
	}
	
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	
	finishReason := "stop"
	if !resp.Done {
		finishReason = "length"
	}
	
	return &ModelOutput{
		Content:      resp.Response,
		FinishReason: finishReason,
		Usage: TokenUsage{
			CompletionTokens: resp.EvalCount,
		},
		Metadata: map[string]any{
			"total_duration_ns": resp.TotalDuration,
		},
	}, nil
}

// DetectLocalCapabilities probes the local environment to suggest model configs.
func DetectLocalCapabilities() []LocalConfig {
	var configs []LocalConfig
	
	// Detect based on available RAM
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	// Estimate available memory (simplified)
	totalRAM := getTotalRAM()
	
	switch {
	case totalRAM >= 16000: // 16GB+
		configs = append(configs, LocalConfig{
			Name:     "local-7b",
			Endpoint: "http://localhost:11434",
			ModelID:  "llama3.1:8b",
			Capabilities: ModelCapabilities{
				MaxContext:      128000,
				ToolCalling:     true,
				Streaming:       true,
				ReasoningDepth:  ReasoningMedium,
				MaxTokens:       4096,
				SupportsJSON:    true,
				Quantization:    "Q4_K_M",
				EstimatedVRAMMB: 5000,
			},
		})
		fallthrough
	case totalRAM >= 8000: // 8GB+
		configs = append(configs, LocalConfig{
			Name:     "local-3b",
			Endpoint: "http://localhost:11434",
			ModelID:  "llama3.2:3b",
			Capabilities: ModelCapabilities{
				MaxContext:      128000,
				ToolCalling:     false,
				Streaming:       true,
				ReasoningDepth:  ReasoningLow,
				MaxTokens:       2048,
				SupportsJSON:    false,
				Quantization:    "Q4_K_M",
				EstimatedVRAMMB: 2000,
			},
		})
	default: // 4GB
		configs = append(configs, LocalConfig{
			Name:     "local-1b",
			Endpoint: "http://localhost:11434",
			ModelID:  "tinyllama:1.1b",
			Capabilities: ModelCapabilities{
				MaxContext:      2048,
				ToolCalling:     false,
				Streaming:       true,
				ReasoningDepth:  ReasoningLow,
				MaxTokens:       1024,
				SupportsJSON:    false,
				Quantization:    "Q4_0",
				EstimatedVRAMMB: 700,
			},
		})
	}
	
	return configs
}

func getTotalRAM() uint64 {
	// Simplified - in production would use gopsutil or platform-specific APIs
	return 8000 // Conservative default
}
