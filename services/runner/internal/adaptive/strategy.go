// Package adaptive provides runtime heuristic layer for adapting
// execution strategy based on model capability, device constraints,
// and network conditions.
package adaptive

import (
	"fmt"
	"reach/services/runner/internal/config"
	"reach/services/runner/internal/model"
)

// ExecutionStrategy defines how to execute a task.
type ExecutionStrategy struct {
	Mode              StrategyMode       `json:"mode"`
	ReasoningDepth    model.ReasoningDepth `json:"reasoningDepth"`
	MaxBranches       int                `json:"maxBranches"`
	EnableDelegation  bool               `json:"enableDelegation"`
	PolicyStrictness  PolicyLevel        `json:"policyStrictness"`
	ContextWindow     int                `json:"contextWindow"`
	TimeoutMultiplier float64            `json:"timeoutMultiplier"`
	CompressionLevel  int                `json:"compressionLevel"`
}

// StrategyMode indicates the execution approach.
type StrategyMode string

const (
	ModeFull       StrategyMode = "full"       // Normal execution
	ModeConservative StrategyMode = "conservative" // Reduced complexity
	ModeMinimal    StrategyMode = "minimal"    // Edge mode fallback
	ModeOffline    StrategyMode = "offline"    // No network, local only
)

// PolicyLevel indicates policy enforcement strictness.
type PolicyLevel string

const (
	PolicyNormal PolicyLevel = "normal"
	PolicyStrict PolicyLevel = "strict"
	PolicyDraconian PolicyLevel = "draconian"
)

// Engine determines execution strategy based on runtime conditions.
type Engine struct {
	config    EngineConfig
	modelMgr  *model.Manager
	deviceCtx DeviceContext
}

// EngineConfig configures the adaptive engine.
type EngineConfig struct {
	// Thresholds for mode selection
	LowMemoryMB        int           `json:"lowMemoryMb"`
	LowBandwidthKbps   int           `json:"lowBandwidthKbps"`
	HighLatencyMs      int           `json:"highLatencyMs"`
	MinModelCapability model.ReasoningDepth `json:"minModelCapability"`
	
	// Adaptive behaviors
	AutoCompressContext bool `json:"autoCompressContext"`
	AutoDisableBranching bool `json:"autoDisableBranching"`
}

// DefaultEngineConfig returns sensible defaults.
func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		LowMemoryMB:         512,
		LowBandwidthKbps:    100,
		HighLatencyMs:       1000,
		MinModelCapability:  model.ReasoningLow,
		AutoCompressContext: true,
		AutoDisableBranching: true,
	}
}

// DeviceContext describes the runtime environment.
type DeviceContext struct {
	AvailableRAMMB uint64 `json:"availableRamMb"`
	TotalRAMMB     uint64 `json:"totalRamMb"`
	CPUCount       int    `json:"cpuCount"`
	IsMobile       bool   `json:"isMobile"`
	IsOffline      bool   `json:"isOffline"`
	NetworkLatencyMs int  `json:"networkLatencyMs"`
}

// NewEngine creates an adaptive execution engine.
func NewEngine(cfg EngineConfig, modelMgr *model.Manager) *Engine {
	return &Engine{
		config:    cfg,
		modelMgr:  modelMgr,
		deviceCtx: detectDeviceContext(),
	}
}

// DetectContext updates the device context.
func (e *Engine) DetectContext() {
	e.deviceCtx = detectDeviceContext()
}

// DetermineStrategy selects the best execution strategy.
func (e *Engine) DetermineStrategy(task TaskConstraints) (ExecutionStrategy, error) {
	strategy := ExecutionStrategy{
		Mode:              ModeFull,
		ReasoningDepth:    model.ReasoningHigh,
		MaxBranches:       10,
		EnableDelegation:  true,
		PolicyStrictness:  PolicyNormal,
		ContextWindow:     128000,
		TimeoutMultiplier: 1.0,
		CompressionLevel:  0,
	}
	
	// Check device constraints
	if e.deviceCtx.IsMobile {
		strategy.Mode = ModeConservative
		strategy.MaxBranches = 3
		strategy.ContextWindow = 8192
		strategy.CompressionLevel = 1
	}
	
	if e.deviceCtx.AvailableRAMMB < uint64(e.config.LowMemoryMB) {
		strategy.Mode = ModeMinimal
		strategy.ReasoningDepth = model.ReasoningLow
		strategy.MaxBranches = 1
		strategy.ContextWindow = 4096
		strategy.CompressionLevel = 2
		strategy.PolicyStrictness = PolicyStrict
	}
	
	if e.deviceCtx.IsOffline {
		strategy.Mode = ModeOffline
		strategy.EnableDelegation = false
		strategy.ReasoningDepth = model.ReasoningLow
	}
	
	// Check model capability
	if e.modelMgr != nil {
		defaultAdapter := e.modelMgr.DefaultAdapter()
		// Small mode or local models have lower capability
		if defaultAdapter == "small-mode" {
			strategy.Mode = ModeMinimal
			strategy.ReasoningDepth = model.ReasoningLow
			strategy.MaxBranches = 1
			strategy.ContextWindow = 4096
		}
	}
	
	// Check task-specific constraints
	if task.RequireComplexReasoning {
		// If we need complex reasoning but can't provide it, error
		if strategy.ReasoningDepth == model.ReasoningLow {
			return strategy, fmt.Errorf("task requires complex reasoning but device constrained to low")
		}
	}
	
	if task.Critical {
		strategy.PolicyStrictness = PolicyDraconian
	}
	
	if task.TimeSensitive {
		strategy.TimeoutMultiplier = 0.5
	}
	
	return strategy, nil
}

// TaskConstraints describes what a task needs.
type TaskConstraints struct {
	RequireComplexReasoning bool `json:"requireComplexReasoning"`
	RequireToolCalling      bool `json:"requireToolCalling"`
	RequireDelegation       bool `json:"requireDelegation"`
	Critical                bool `json:"critical"`
	TimeSensitive           bool `json:"timeSensitive"`
	EstimatedContextTokens  int  `json:"estimatedContextTokens"`
}

// AdaptInput adapts input based on strategy.
func AdaptInput(input string, strategy ExecutionStrategy) string {
	if strategy.CompressionLevel == 0 {
		return input
	}
	
	// Apply compression based on level
	switch strategy.CompressionLevel {
	case 1:
		// Light compression: remove redundant whitespace
		return compressLight(input)
	case 2:
		// Heavy compression: truncate and summarize
		return compressHeavy(input, strategy.ContextWindow)
	default:
		return input
	}
}

func compressLight(input string) string {
	// Simple whitespace normalization
	result := make([]rune, 0, len(input))
	lastWasSpace := false
	
	for _, r := range input {
		if r == ' ' || r == '\t' || r == '\n' {
			if !lastWasSpace {
				result = append(result, ' ')
				lastWasSpace = true
			}
		} else {
			result = append(result, r)
			lastWasSpace = false
		}
	}
	
	return string(result)
}

func compressHeavy(input string, maxTokens int) string {
	// Estimate tokens (roughly 4 chars per token)
	maxChars := maxTokens * 4
	
	if len(input) <= maxChars {
		return compressLight(input)
	}
	
	// Truncate with notice
	truncated := input[:maxChars-100]
	return truncated + "\n\n[Content truncated due to context limits. Using edge mode.]"
}

// SimplifyTree reduces reasoning tree complexity.
func SimplifyTree(tree *ReasoningTree, maxDepth int) *ReasoningTree {
	if tree == nil || maxDepth <= 0 {
		return &ReasoningTree{
			Action: "simplified",
			Reason: "Execution simplified due to device constraints",
		}
	}
	
	if len(tree.Children) > maxDepth {
		// Prune excess branches
		tree.Children = tree.Children[:maxDepth]
	}
	
	// Recursively simplify children
	for i := range tree.Children {
		tree.Children[i] = SimplifyTree(tree.Children[i], maxDepth-1)
	}
	
	return tree
}

// ReasoningTree represents a plan of action.
type ReasoningTree struct {
	Action   string          `json:"action"`
	Reason   string          `json:"reason"`
	Children []*ReasoningTree `json:"children,omitempty"`
}

// ShouldPrune determines if a branch should be pruned.
func (e *Engine) ShouldPrune(strategy ExecutionStrategy, depth int) bool {
	if strategy.MaxBranches <= 0 {
		return false // No limit
	}
	return depth >= strategy.MaxBranches
}

// CanDelegate determines if delegation is allowed.
func (e *Engine) CanDelegate(strategy ExecutionStrategy) bool {
	if !strategy.EnableDelegation {
		return false
	}
	if e.deviceCtx.IsOffline {
		return false
	}
	if e.deviceCtx.NetworkLatencyMs > e.config.HighLatencyMs {
		// High latency - prefer local execution
		return false
	}
	return true
}

// PolicyOverride returns policy adjustments.
func (e *Engine) PolicyOverride(strategy ExecutionStrategy) PolicyOverride {
	switch strategy.PolicyStrictness {
	case PolicyDraconian:
		return PolicyOverride{
			DenyUnknownTools: true,
			RequireSignedPacks: true,
			AuditAll: true,
		}
	case PolicyStrict:
		return PolicyOverride{
			DenyUnknownTools: true,
			RequireSignedPacks: false,
			AuditAll: true,
		}
	default: // PolicyNormal
		return PolicyOverride{
			DenyUnknownTools: false,
			RequireSignedPacks: false,
			AuditAll: false,
		}
	}
}

// PolicyOverride contains policy adjustments.
type PolicyOverride struct {
	DenyUnknownTools   bool `json:"denyUnknownTools"`
	RequireSignedPacks bool `json:"requireSignedPacks"`
	AuditAll           bool `json:"auditAll"`
}

func detectDeviceContext() DeviceContext {
	ctx := DeviceContext{
		CPUCount: model.DetectPlatform().CPUCount,
	}
	
	// Platform detection
	platform := model.DetectPlatform()
	ctx.IsMobile = platform.IsAndroid
	ctx.TotalRAMMB = platform.TotalRAM
	ctx.AvailableRAMMB = platform.AvailableRAM
	
	// Network detection (simplified)
	ctx.IsOffline = false // Would check connectivity
	ctx.NetworkLatencyMs = 50 // Default assumption
	
	return ctx
}

// Integration with config
func StrategyFromConfig(cfg *config.Config) EngineConfig {
	return EngineConfig{
		LowMemoryMB:         cfg.EdgeMode.MemoryCapMB,
		AutoCompressContext: cfg.EdgeMode.SimplifyReasoning,
		AutoDisableBranching: cfg.EdgeMode.DisableBranching,
		MinModelCapability:  model.ReasoningLow,
	}
}

// IsEdgeMode returns true if strategy is edge/minimal mode.
func (s ExecutionStrategy) IsEdgeMode() bool {
	return s.Mode == ModeMinimal || s.Mode == ModeOffline
}

// ContextBudget calculates available context budget.
func (s ExecutionStrategy) ContextBudget() int {
	// Reserve 10% for system/overhead
	return int(float64(s.ContextWindow) * 0.9)
}
