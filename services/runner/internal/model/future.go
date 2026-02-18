// Package model - future compatibility layer
// This file provides forward compatibility for emerging LLM capabilities:
// - 1M+ context windows
// - Tool-native planning
// - Ultra-small distilled models
package model

import (
	"fmt"
	"strings"
)

// ContextNegotiator handles context window negotiation with models.
type ContextNegotiator struct {
	targetWindow  int
	maxWindow     int
	minWindow     int
	chunkSize     int
}

// NegotiationResult describes the agreed context parameters.
type NegotiationResult struct {
	WindowSize    int  `json:"windowSize"`
	ChunkCount    int  `json:"chunkCount"`
	RequiresChunking bool `json:"requiresChunking"`
	OverheadTokens int `json:"overheadTokens"`
}

// NewContextNegotiator creates a negotiator with sensible defaults.
func NewContextNegotiator(targetWindow int) *ContextNegotiator {
	return &ContextNegotiator{
		targetWindow: targetWindow,
		maxWindow:    128000,  // Current practical max
		minWindow:    4096,    // Minimum viable
		chunkSize:    2048,    // Chunks for very long contexts
	}
}

// Negotiate determines the optimal context window with a model.
func (n *ContextNegotiator) Negotiate(adapter ReachModelAdapter, requiredTokens int) NegotiationResult {
	caps := adapter.Capabilities()
	modelMax := caps.MaxContext
	
	// Start with what we want
	window := n.targetWindow
	
	// Cap at model maximum
	if window > modelMax {
		window = modelMax
	}
	
	// If we need more than the model can handle, chunk
	if requiredTokens > window {
		chunks := (requiredTokens + n.chunkSize - 1) / n.chunkSize
		return NegotiationResult{
			WindowSize:       window,
			ChunkCount:       chunks,
			RequiresChunking: true,
			OverheadTokens:   chunks * 100, // Overhead per chunk separator
		}
	}
	
	return NegotiationResult{
		WindowSize:       window,
		ChunkCount:       1,
		RequiresChunking: false,
		OverheadTokens:   0,
	}
}

// TokenBudget provides token allocation across context components.
type TokenBudget struct {
	SystemPrompt     int `json:"systemPrompt"`
	UserInput        int `json:"userInput"`
	ToolDefinitions  int `json:"toolDefinitions"`
	ResponseBuffer   int `json:"responseBuffer"`
	WorkingMemory    int `json:"workingMemory"`
	Reserved         int `json:"reserved"`
}

// BudgetConfig configures token budgeting.
type BudgetConfig struct {
	TotalTokens      int
	ResponseTokens   int
	ToolCount        int
	ComplexityFactor float64 // 0.5 - 2.0
}

// CalculateBudget allocates tokens across components.
func CalculateBudget(config BudgetConfig) TokenBudget {
	// Reserve 10% for overhead
	available := int(float64(config.TotalTokens) * 0.9)
	
	// Response takes fixed amount
	response := config.ResponseTokens
	if response > available/2 {
		response = available / 2 // Cap at 50%
	}
	
	// Tools take space based on count
	toolOverhead := config.ToolCount * 200 // 200 tokens per tool
	
	// Remaining for context
	remaining := available - response - toolOverhead
	if remaining < 0 {
		remaining = 1000 // Minimum context
	}
	
	// Split based on complexity
	systemBase := int(500 * config.ComplexityFactor)
	if systemBase > remaining/3 {
		systemBase = remaining / 3
	}
	
	return TokenBudget{
		SystemPrompt:    systemBase,
		UserInput:       remaining - systemBase,
		ToolDefinitions: toolOverhead,
		ResponseBuffer:  response,
		WorkingMemory:   int(float64(remaining) * 0.1),
		Reserved:        int(float64(config.TotalTokens) * 0.1),
	}
}

// PromptChunker handles chunking for very long contexts.
type PromptChunker struct {
	chunkSize    int
	overlapSize  int
}

// NewPromptChunker creates a chunker for long prompts.
func NewPromptChunker(chunkSize int) *PromptChunker {
	return &PromptChunker{
		chunkSize:   chunkSize,
		overlapSize: chunkSize / 10, // 10% overlap
	}
}

// Chunk breaks a long prompt into processable chunks.
func (c *PromptChunker) Chunk(prompt string) []string {
	if len(prompt) <= c.chunkSize {
		return []string{prompt}
	}
	
	// Simple word-based chunking
	words := strings.Fields(prompt)
	var chunks []string
	
	for i := 0; i < len(words); i += c.chunkSize - c.overlapSize {
		end := i + c.chunkSize
		if end > len(words) {
			end = len(words)
		}
		
		chunk := strings.Join(words[i:end], " ")
		chunks = append(chunks, chunk)
		
		if end == len(words) {
			break
		}
	}
	
	return chunks
}

// CapabilityDetector probes model capabilities via handshake.
type CapabilityDetector struct {
	probes []CapabilityProbe
}

// CapabilityProbe tests a specific capability.
type CapabilityProbe struct {
	Name        string `json:"name"`
	TestPrompt  string `json:"testPrompt"`
	Expected    string `json:"expected"`
	TimeoutMs   int    `json:"timeoutMs"`
}

// NewCapabilityDetector creates a detector with standard probes.
func NewCapabilityDetector() *CapabilityDetector {
	return &CapabilityDetector{
		probes: []CapabilityProbe{
			{
				Name:       "json_mode",
				TestPrompt: "Respond with valid JSON only: {\"test\": true}",
				Expected:   `{"test":`,
				TimeoutMs:  5000,
			},
			{
				Name:       "tool_use",
				TestPrompt: "You have a tool 'calculate' available. Calculate 2+2.",
				Expected:   "tool_call",
				TimeoutMs:  5000,
			},
			{
				Name:       "long_context",
				TestPrompt: strings.Repeat("word ", 50000) + "\nWhat is the last word?",
				Expected:   "word",
				TimeoutMs:  10000,
			},
		},
	}
}

// DetectionResult contains discovered capabilities.
type DetectionResult struct {
	SupportedCapabilities []string          `json:"supportedCapabilities"`
	MaxTestedContext      int               `json:"maxTestedContext"`
	LatencyMs             map[string]int    `json:"latencyMs"`
	Error                 string            `json:"error,omitempty"`
}

// Detect runs capability probes against an adapter.
func (d *CapabilityDetector) Detect(adapter ReachModelAdapter) DetectionResult {
	result := DetectionResult{
		SupportedCapabilities: make([]string, 0),
		LatencyMs:             make(map[string]int),
	}
	
	// In practice, would run probes here
	// For now, use adapter's reported capabilities
	caps := adapter.Capabilities()
	
	if caps.SupportsJSON {
		result.SupportedCapabilities = append(result.SupportedCapabilities, "json_mode")
	}
	if caps.ToolCalling {
		result.SupportedCapabilities = append(result.SupportedCapabilities, "tool_use")
	}
	if caps.MaxContext >= 32000 {
		result.SupportedCapabilities = append(result.SupportedCapabilities, "long_context")
	}
	
	result.MaxTestedContext = caps.MaxContext
	
	return result
}

// FutureModelAdapter prepares for future model types.
type FutureModelAdapter struct {
	*HostedAdapter
	
	// Future capabilities
	supportsNativePlanning bool
	supportsMultiModal     bool
	supportsStreamingTools bool
}

// FutureCapabilities describes emerging capabilities.
type FutureCapabilities struct {
	NativePlanning  bool `json:"nativePlanning"`
	MultiModal      bool `json:"multiModal"`
	StreamingTools  bool `json:"streamingTools"`
	UltraLongContext bool `json:"ultraLongContext"`
	Distilled       bool `json:"distilled"`
}

// FutureProofConfig wraps a standard config with future-proofing.
type FutureProofConfig struct {
	BaseConfig     GenerateOptions    `json:"baseConfig"`
	Negotiated     NegotiationResult  `json:"negotiated"`
	Budget         TokenBudget        `json:"budget"`
	ChunkIndex     int                `json:"chunkIndex"`
	TotalChunks    int                `json:"totalChunks"`
}

// CreateFutureProofConfig builds a config that works with current and future models.
func CreateFutureProofConfig(adapter ReachModelAdapter, input GenerateInput, opts GenerateOptions) (FutureProofConfig, error) {
	caps := adapter.Capabilities()
	
	// Negotiate context window
	negotiator := NewContextNegotiator(caps.MaxContext)
	
	// Estimate tokens
	estimatedTokens := estimateInputTokens(input)
	
	negotiated := negotiator.Negotiate(adapter, estimatedTokens)
	
	// Calculate budget
	budget := CalculateBudget(BudgetConfig{
		TotalTokens:      negotiated.WindowSize,
		ResponseTokens:   opts.MaxTokens,
		ToolCount:        len(opts.Tools),
		ComplexityFactor: complexityFromDepth(caps.ReasoningDepth),
	})
	
	return FutureProofConfig{
		BaseConfig:  opts,
		Negotiated:  negotiated,
		Budget:      budget,
		ChunkIndex:  0,
		TotalChunks: negotiated.ChunkCount,
	}, nil
}

func estimateInputTokens(input GenerateInput) int {
	total := 0
	for _, m := range input.Messages {
		// Rough estimate
		total += len(m.Content) / 4
	}
	return total
}

func complexityFromDepth(depth ReasoningDepth) float64 {
	switch depth {
	case ReasoningLow:
		return 0.5
	case ReasoningMedium:
		return 1.0
	case ReasoningHigh:
		return 1.5
	default:
		return 1.0
	}
}

// VersionCompatibility handles model version transitions.
type VersionCompatibility struct {
	MinSupportedVersion string            `json:"minSupportedVersion"`
	MaxTestedVersion    string            `json:"maxTestedVersion"`
	DeprecationWarnings []string          `json:"deprecationWarnings"`
	MigrationGuides     map[string]string `json:"migrationGuides"`
}

// CurrentCompatibility returns the current compatibility matrix.
func CurrentCompatibility() VersionCompatibility {
	return VersionCompatibility{
		MinSupportedVersion: "1.0",
		MaxTestedVersion:    "3.0",
		DeprecationWarnings: []string{
			"context_window < 4096 is deprecated",
		},
		MigrationGuides: map[string]string{
			"tool_format_v1": "Migrate to tool format v2 for streaming support",
		},
	}
}

// ValidateCompatibility checks if a model version is supported.
func ValidateCompatibility(modelVersion string) error {
	compat := CurrentCompatibility()
	
	// Simple version comparison
	if modelVersion < compat.MinSupportedVersion {
		return fmt.Errorf("model version %s is below minimum supported %s",
			modelVersion, compat.MinSupportedVersion)
	}
	
	if modelVersion > compat.MaxTestedVersion {
		return fmt.Errorf("model version %s is newer than max tested %s; proceed with caution",
			modelVersion, compat.MaxTestedVersion)
	}
	
	return nil
}

// FeatureFlag controls access to experimental features.
type FeatureFlag struct {
	Name         string `json:"name"`
	Enabled      bool   `json:"enabled"`
	RequiresCaps string `json:"requiresCaps"`
	MinModelTier string `json:"minModelTier"`
}

// FeatureFlags for future capabilities.
var FeatureFlags = []FeatureFlag{
	{
		Name:         "native_planning",
		Enabled:      false,
		RequiresCaps: "nativePlanning",
		MinModelTier: "large",
	},
	{
		Name:         "ultra_context",
		Enabled:      false,
		RequiresCaps: "ultraLongContext",
		MinModelTier: "large",
	},
	{
		Name:         "streaming_tools",
		Enabled:      false,
		RequiresCaps: "streamingTools",
		MinModelTier: "medium",
	},
	{
		Name:         "multimodal_input",
		Enabled:      false,
		RequiresCaps: "multiModal",
		MinModelTier: "large",
	},
}

// CheckFeature returns true if a feature is available.
func CheckFeature(feature string, caps FutureCapabilities) bool {
	for _, flag := range FeatureFlags {
		if flag.Name != feature {
			continue
		}
		if !flag.Enabled {
			return false
		}
		
		switch flag.RequiresCaps {
		case "nativePlanning":
			return caps.NativePlanning
		case "multiModal":
			return caps.MultiModal
		case "streamingTools":
			return caps.StreamingTools
		case "ultraLongContext":
			return caps.UltraLongContext
		}
	}
	return false
}

// ModelCompatibilityLayer adapts between model versions.
type ModelCompatibilityLayer struct {
	targetVersion string
}

// NewCompatibilityLayer creates an adapter for version compatibility.
func NewCompatibilityLayer(targetVersion string) *ModelCompatibilityLayer {
	return &ModelCompatibilityLayer{targetVersion: targetVersion}
}

// AdaptRequest converts a request to the target version format.
func (l *ModelCompatibilityLayer) AdaptRequest(input map[string]any) map[string]any {
	// Version-specific transformations
	switch l.targetVersion {
	case "v1":
		// Legacy format
		return adaptToV1(input)
	case "v2":
		// Current format
		return input
	case "v3":
		// Future format
		return adaptToV3(input)
	default:
		return input
	}
}

func adaptToV1(input map[string]any) map[string]any {
	// Convert v2 features to v1 compatible
	result := make(map[string]any)
	for k, v := range input {
		result[k] = v
	}
	// Remove v2-only fields
	delete(result, "tools")
	delete(result, "response_format")
	return result
}

func adaptToV3(input map[string]any) map[string]any {
	// Add v3 fields if missing
	result := make(map[string]any)
	for k, v := range input {
		result[k] = v
	}
	// Add v3 defaults
	if _, ok := result["stream_options"]; !ok {
		result["stream_options"] = map[string]any{"include_usage": true}
	}
	return result
}
