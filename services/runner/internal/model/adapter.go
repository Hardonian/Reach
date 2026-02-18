// Package model provides a unified abstraction layer for LLM adapters,
// enabling Reach to work with hosted models, local OSS models, and
// deterministic fallbacks in constrained environments.
package model

import (
	"context"
	"encoding/json"
	"fmt"
)

// ReasoningDepth indicates the complexity level a model supports.
type ReasoningDepth string

const (
	ReasoningLow    ReasoningDepth = "low"
	ReasoningMedium ReasoningDepth = "medium"
	ReasoningHigh   ReasoningDepth = "high"
)

// ModelCapabilities describes what a model can do.
type ModelCapabilities struct {
	MaxContext      int            `json:"maxContext"`
	ToolCalling     bool           `json:"toolCalling"`
	Streaming       bool           `json:"streaming"`
	ReasoningDepth  ReasoningDepth `json:"reasoningDepth"`
	MaxTokens       int            `json:"maxTokens"`
	SupportsJSON    bool           `json:"supportsJson"`
	Quantization    string         `json:"quantization,omitempty"`
	EstimatedVRAMMB int            `json:"estimatedVramMb,omitempty"`
}

// GenerateOptions configures a generation request.
type GenerateOptions struct {
	Temperature     float64           `json:"temperature,omitempty"`
	MaxTokens       int               `json:"maxTokens,omitempty"`
	TopP            float64           `json:"topP,omitempty"`
	TopK            int               `json:"topK,omitempty"`
	StopSequences   []string          `json:"stopSequences,omitempty"`
	Tools           []ToolDefinition  `json:"tools,omitempty"`
	RequireJSON     bool              `json:"requireJson,omitempty"`
	JSONSchema      json.RawMessage   `json:"jsonSchema,omitempty"`
	SystemPrompt    string            `json:"systemPrompt,omitempty"`
}

// ToolDefinition describes a tool available to the model.
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ToolCall represents a tool invocation from the model.
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// ModelOutput is the standardized response from any model adapter.
type ModelOutput struct {
	Content      string           `json:"content,omitempty"`
	ToolCalls    []ToolCall       `json:"toolCalls,omitempty"`
	FinishReason string           `json:"finishReason"`
	Usage        TokenUsage       `json:"usage"`
	Metadata     map[string]any   `json:"metadata,omitempty"`
	Error        error            `json:"-"`
}

// TokenUsage tracks consumption.
type TokenUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// GenerateInput contains the prompt and context.
type GenerateInput struct {
	Messages []Message `json:"messages"`
	Context  json.RawMessage `json:"context,omitempty"`
}

// Message represents a chat message.
type Message struct {
	Role       string          `json:"role"` // system, user, assistant, tool
	Content    string          `json:"content"`
	ToolCalls  []ToolCall      `json:"toolCalls,omitempty"`
	ToolCallID string          `json:"toolCallId,omitempty"`
}

// ReachModelAdapter is the unified interface for all model backends.
type ReachModelAdapter interface {
	// Name returns the adapter identifier.
	Name() string
	
	// Capabilities describes what this model can do.
	Capabilities() ModelCapabilities
	
	// Generate produces output from the model.
	Generate(ctx context.Context, input GenerateInput, opts GenerateOptions) (*ModelOutput, error)
	
	// Available returns true if the adapter can be used (connected, loaded, etc).
	Available(ctx context.Context) bool
	
	// Health returns detailed health status.
	Health(ctx context.Context) HealthStatus
}

// HealthStatus indicates adapter health.
type HealthStatus struct {
	Healthy     bool     `json:"healthy"`
	LatencyMs   int      `json:"latencyMs"`
	Errors      []string `json:"errors,omitempty"`
	LastChecked int64    `json:"lastChecked"`
}

// AdapterRegistry manages multiple model adapters.
type AdapterRegistry struct {
	adapters map[string]ReachModelAdapter
	defaultAdapter string
}

// NewAdapterRegistry creates a new registry.
func NewAdapterRegistry() *AdapterRegistry {
	return &AdapterRegistry{
		adapters: make(map[string]ReachModelAdapter),
	}
}

// Register adds an adapter to the registry.
func (r *AdapterRegistry) Register(adapter ReachModelAdapter) error {
	if adapter == nil {
		return fmt.Errorf("cannot register nil adapter")
	}
	name := adapter.Name()
	if name == "" {
		return fmt.Errorf("adapter name cannot be empty")
	}
	r.adapters[name] = adapter
	return nil
}

// SetDefault marks an adapter as the default.
func (r *AdapterRegistry) SetDefault(name string) error {
	if _, ok := r.adapters[name]; !ok {
		return fmt.Errorf("adapter %q not found", name)
	}
	r.defaultAdapter = name
	return nil
}

// Get retrieves an adapter by name, or the default if name is empty.
func (r *AdapterRegistry) Get(name string) (ReachModelAdapter, error) {
	if name == "" {
		if r.defaultAdapter == "" {
			return nil, fmt.Errorf("no default adapter set")
		}
		return r.adapters[r.defaultAdapter], nil
	}
	adapter, ok := r.adapters[name]
	if !ok {
		return nil, fmt.Errorf("adapter %q not found", name)
	}
	return adapter, nil
}

// List returns all registered adapter names.
func (r *AdapterRegistry) List() []string {
	names := make([]string, 0, len(r.adapters))
	for name := range r.adapters {
		names = append(names, name)
	}
	return names
}

// AvailableAdapters returns only healthy adapters.
func (r *AdapterRegistry) AvailableAdapters(ctx context.Context) []ReachModelAdapter {
	available := make([]ReachModelAdapter, 0)
	for _, adapter := range r.adapters {
		if adapter.Available(ctx) {
			available = append(available, adapter)
		}
	}
	return available
}

// RouteInput contains parameters for routing decisions.
type RouteInput struct {
	Complexity     Complexity   `json:"complexity"`
	RequireTools   bool         `json:"requireTools"`
	RequireJSON    bool         `json:"requireJson"`
	MaxLatencyMs   int          `json:"maxLatencyMs"`
	Offline        bool         `json:"offline"`
	PreferredModel string       `json:"preferredModel,omitempty"`
	ContextTokens  int          `json:"contextTokens"`
}

// Complexity estimates task difficulty.
type Complexity string

const (
	ComplexitySimple  Complexity = "simple"
	ComplexityNormal  Complexity = "normal"
	ComplexityComplex Complexity = "complex"
)

// Router selects the best adapter for a given task.
type Router struct {
	registry *AdapterRegistry
	config   RouterConfig
}

// RouterConfig tunes routing behavior.
type RouterConfig struct {
	PreferLocal     bool `json:"preferLocal"`
	FallbackEnabled bool `json:"fallbackEnabled"`
	EdgeMode        bool `json:"edgeMode"`
}

// NewRouter creates a routing layer.
func NewRouter(registry *AdapterRegistry, config RouterConfig) *Router {
	return &Router{
		registry: registry,
		config:   config,
	}
}

// Route selects the best adapter for the input.
func (r *Router) Route(ctx context.Context, input RouteInput) (ReachModelAdapter, error) {
	// If preferred model specified, try it first
	if input.PreferredModel != "" {
		adapter, err := r.registry.Get(input.PreferredModel)
		if err == nil && adapter.Available(ctx) {
			if r.matchesRequirements(adapter, input) {
				return adapter, nil
			}
		}
	}
	
	// Get all available adapters
	available := r.registry.AvailableAdapters(ctx)
	if len(available) == 0 {
		return nil, fmt.Errorf("no model adapters available")
	}
	
	// Edge mode: prefer smallest/fastest model
	if r.config.EdgeMode || input.Offline {
		return r.selectEdgeAdapter(available, input)
	}
	
	// Normal routing: match capabilities to complexity
	return r.selectBestAdapter(available, input)
}

func (r *Router) matchesRequirements(adapter ReachModelAdapter, input RouteInput) bool {
	caps := adapter.Capabilities()
	
	if input.RequireTools && !caps.ToolCalling {
		return false
	}
	if input.RequireJSON && !caps.SupportsJSON {
		return false
	}
	if input.ContextTokens > caps.MaxContext {
		return false
	}
	return true
}

func (r *Router) selectEdgeAdapter(adapters []ReachModelAdapter, input RouteInput) (ReachModelAdapter, error) {
	// Select smallest model that can handle the task
	var selected ReachModelAdapter
	var selectedVRAM int = int(^uint(0) >> 1) // MaxInt
	
	for _, adapter := range adapters {
		caps := adapter.Capabilities()
		
		// Skip if can't meet requirements
		if !r.matchesRequirements(adapter, input) {
			continue
		}
		
		// Prefer smallest VRAM footprint
		if caps.EstimatedVRAMMB < selectedVRAM {
			selected = adapter
			selectedVRAM = caps.EstimatedVRAMMB
		}
	}
	
	if selected == nil {
		return nil, fmt.Errorf("no edge-suitable adapter found")
	}
	return selected, nil
}

func (r *Router) selectBestAdapter(adapters []ReachModelAdapter, input RouteInput) (ReachModelAdapter, error) {
	var selected ReachModelAdapter
	var bestScore int
	
	for _, adapter := range adapters {
		caps := adapter.Capabilities()
		
		if !r.matchesRequirements(adapter, input) {
			continue
		}
		
		score := r.scoreAdapter(caps, input)
		if score > bestScore {
			bestScore = score
			selected = adapter
		}
	}
	
	if selected == nil {
		return nil, fmt.Errorf("no suitable adapter found for requirements")
	}
	return selected, nil
}

func (r *Router) scoreAdapter(caps ModelCapabilities, input RouteInput) int {
	score := 0
	
	// Prefer models with sufficient but not excessive context
	if caps.MaxContext >= input.ContextTokens*2 {
		score += 10
	} else if caps.MaxContext >= input.ContextTokens {
		score += 5
	}
	
	// Tool calling bonus if needed
	if input.RequireTools && caps.ToolCalling {
		score += 20
	}
	
	// JSON support bonus if needed
	if input.RequireJSON && caps.SupportsJSON {
		score += 15
	}
	
	// Complexity matching
	switch input.Complexity {
	case ComplexitySimple:
		if caps.ReasoningDepth == ReasoningLow {
			score += 10
		}
	case ComplexityComplex:
		if caps.ReasoningDepth == ReasoningHigh {
			score += 15
		}
	case ComplexityNormal:
		if caps.ReasoningDepth == ReasoningMedium {
			score += 10
		}
	}
	
	// Edge mode: penalize large models
	if r.config.EdgeMode {
		score -= caps.EstimatedVRAMMB / 100
	}
	
	return score
}
