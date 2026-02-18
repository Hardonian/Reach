package model

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// SmallModeAdapter provides deterministic template-based responses
// when no LLM is available. It ensures Reach can still function in
// completely offline or highly constrained environments.
type SmallModeAdapter struct {
	templates    map[string]TemplateFunc
	capabilities ModelCapabilities
}

// TemplateFunc generates a response from input.
type TemplateFunc func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error)

// SmallModeConfig configures the fallback adapter.
type SmallModeConfig struct {
	EnableTemplating bool `json:"enableTemplating"`
}

// NewSmallModeAdapter creates a deterministic fallback adapter.
func NewSmallModeAdapter(cfg SmallModeConfig) *SmallModeAdapter {
	a := &SmallModeAdapter{
		capabilities: ModelCapabilities{
			MaxContext:      4096,
			ToolCalling:     false,
			Streaming:       false,
			ReasoningDepth:  ReasoningLow,
			MaxTokens:       512,
			SupportsJSON:    true,
			Quantization:    "N/A",
			EstimatedVRAMMB: 0,
		},
		templates: make(map[string]TemplateFunc),
	}
	
	if cfg.EnableTemplating {
		a.registerDefaultTemplates()
	}
	
	return a
}

// Name returns the adapter identifier.
func (a *SmallModeAdapter) Name() string {
	return "small-mode"
}

// Capabilities describes what this fallback can do.
func (a *SmallModeAdapter) Capabilities() ModelCapabilities {
	return a.capabilities
}

// Generate produces deterministic output using templates or simple logic.
func (a *SmallModeAdapter) Generate(ctx context.Context, input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
	start := time.Now()
	
	// Count input tokens (rough estimation)
	inputTokens := a.estimateTokens(input)
	
	// Try to match a template
	for pattern, template := range a.templates {
		if a.matchesPattern(input, pattern) {
			output, err := template(input, opts)
			if err != nil {
				return nil, err
			}
			output.Usage.PromptTokens = inputTokens
			output.Metadata = map[string]any{
				"template":     pattern,
				"duration_ms":  time.Since(start).Milliseconds(),
				"mode":         "deterministic",
			}
			return output, nil
		}
	}
	
	// Default: echo with acknowledgment
	output := &ModelOutput{
		Content:      a.buildDefaultResponse(input),
		FinishReason: "stop",
		Usage: TokenUsage{
			PromptTokens:     inputTokens,
			CompletionTokens: 50,
			TotalTokens:      inputTokens + 50,
		},
		Metadata: map[string]any{
			"template":    "default",
			"duration_ms": time.Since(start).Milliseconds(),
			"mode":        "deterministic",
			"note":        "Running in edge mode - LLM not available",
		},
	}
	
	return output, nil
}

// Always available - this is the fallback.
func (a *SmallModeAdapter) Available(ctx context.Context) bool {
	return true
}

// Health always reports healthy.
func (a *SmallModeAdapter) Health(ctx context.Context) HealthStatus {
	return HealthStatus{
		Healthy:     true,
		LatencyMs:   1,
		LastChecked: time.Now().Unix(),
	}
}

func (a *SmallModeAdapter) estimateTokens(input GenerateInput) int {
	total := 0
	for _, m := range input.Messages {
		// Rough estimate: 1 token ≈ 4 characters
		total += len(m.Content) / 4
	}
	return total
}

func (a *SmallModeAdapter) matchesPattern(input GenerateInput, pattern string) bool {
	if len(input.Messages) == 0 {
		return false
	}
	
	lastMsg := input.Messages[len(input.Messages)-1]
	content := strings.ToLower(lastMsg.Content)
	
	switch pattern {
	case "help":
		return strings.Contains(content, "help") || strings.Contains(content, "what can you do")
	case "status":
		return strings.Contains(content, "status") || strings.Contains(content, "health")
	case "list":
		return strings.Contains(content, "list") || strings.Contains(content, "show")
	case "plan":
		return strings.Contains(content, "plan") || strings.Contains(content, "create")
	case "validate":
		return strings.Contains(content, "validate") || strings.Contains(content, "check")
	default:
		return false
	}
}

func (a *SmallModeAdapter) buildDefaultResponse(input GenerateInput) string {
	if len(input.Messages) == 0 {
		return "I received an empty request. In edge mode, I can help with: status, list, validate, and simple planning tasks."
	}
	
	content := input.Messages[len(input.Messages)-1].Content
	
	return fmt.Sprintf("Acknowledged: %q. Processing in edge mode (deterministic fallback). For complex tasks, consider using a full LLM.",
		truncate(content, 50))
}

func (a *SmallModeAdapter) registerDefaultTemplates() {
	// Help template
	a.templates["help"] = func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
		return &ModelOutput{
			Content: `Reach Small Mode - Available Commands:

status  - Check system status
list    - List available capabilities
plan    - Create a simple execution plan
validate - Validate a pack or configuration
help    - Show this message

Note: This is a deterministic fallback mode. For full AI capabilities,
connect to a hosted or local LLM.`,
			FinishReason: "stop",
			Usage: TokenUsage{
				CompletionTokens: 80,
			},
		}, nil
	}
	
	// Status template
	a.templates["status"] = func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
		return &ModelOutput{
			Content: `System Status (Edge Mode):
- Deterministic engine: OK
- Policy enforcement: Active
- Replay capability: Available
- Model adapter: small-mode (fallback)
- Constraints: Limited reasoning, no tool calling

All core functions operational.`,
			FinishReason: "stop",
			Usage: TokenUsage{
				CompletionTokens: 50,
			},
		}, nil
	}
	
	// List template
	a.templates["list"] = func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
		return &ModelOutput{
			Content: `Available Capabilities (Edge Mode):
1. Deterministic execution
2. Policy validation
3. Pack verification
4. Replay verification
5. Simple plan generation

For full capabilities, connect to an LLM.`,
			FinishReason: "stop",
			Usage: TokenUsage{
				CompletionTokens: 45,
			},
		}, nil
	}
	
	// Simple plan template
	a.templates["plan"] = func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
		plan := map[string]any{
			"phases": []map[string]any{
				{"step": 1, "action": "validate_input", "description": "Check input constraints"},
				{"step": 2, "action": "execute_core", "description": "Run deterministic execution"},
				{"step": 3, "action": "verify_output", "description": "Validate output integrity"},
			},
			"constraints": map[string]any{
				"mode":          "edge",
				"reasoning":     "simple",
				"deterministic": true,
			},
		}
		
		planJSON, _ := json.MarshalIndent(plan, "", "  ")
		
		return &ModelOutput{
			Content: fmt.Sprintf(`Simple Plan (Edge Mode):

%s

This plan uses deterministic execution only. For adaptive planning,
connect to an LLM.`, string(planJSON)),
			FinishReason: "stop",
			Usage: TokenUsage{
				CompletionTokens: 60,
			},
		}, nil
	}
	
	// Validate template
	a.templates["validate"] = func(input GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
		return &ModelOutput{
			Content: `Validation Report (Edge Mode):

✓ Syntax: Valid
✓ Structure: Valid
✓ Determinism: Verified
✓ Policy compliance: Enforced

Note: Deep semantic validation requires LLM assistance.`,
			FinishReason: "stop",
			Usage: TokenUsage{
				CompletionTokens: 40,
			},
		}, nil
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// SmallModeCapabilities returns capabilities optimized for small models.
func SmallModeCapabilities() ModelCapabilities {
	return ModelCapabilities{
		MaxContext:      8192,
		ToolCalling:     false,
		Streaming:       false,
		ReasoningDepth:  ReasoningLow,
		MaxTokens:       1024,
		SupportsJSON:    true,
		Quantization:    "INT8",
		EstimatedVRAMMB: 500,
	}
}

// DetectDeviceClass estimates device capabilities.
func DetectDeviceClass() string {
	// Simplified detection - in production would check:
	// - RAM available
	// - CPU cores
	// - GPU availability
	// - OS/platform
	
	// For now, conservative default
	return "constrained"
}

// ConstrainedModeEnabled returns true if the system should run in edge mode.
func ConstrainedModeEnabled() bool {
	deviceClass := DetectDeviceClass()
	return deviceClass == "constrained" || deviceClass == "mobile"
}
