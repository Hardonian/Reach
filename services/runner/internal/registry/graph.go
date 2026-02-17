package registry

import "encoding/json"

// ExecutionGraph represents the DAG of execution nodes.
type ExecutionGraph struct {
	Nodes       map[string]Node `json:"nodes"`
	Edges       []Edge          `json:"edges"`
	StartNodeID string          `json:"start_node_id"`
}

// NodeType defines the behavior of a node.
type NodeType string

const (
	NodeTypeAction    NodeType = "action"
	NodeTypeCondition NodeType = "condition"
	NodeTypeParallel  NodeType = "parallel"
	NodeTypeSubGraph  NodeType = "subgraph" // Future proofing
)

// Node represents a single step in the execution graph.
type Node struct {
	ID   string   `json:"id"`
	Type NodeType `json:"type"`
	Name string   `json:"name"`
	// Config holds type-specific configuration (e.g. Tool name and args for Action nodes)
	Config        json.RawMessage `json:"config,omitempty"`
	Strategy      Strategy        `json:"strategy,omitempty"`
	Deterministic bool            `json:"deterministic"` // If true, forces strict deterministic behavior
}

// Edge connects two nodes and defines flow.
type Edge struct {
	From      string   `json:"from"`
	To        string   `json:"to"`
	Type      EdgeType `json:"type"`
	Condition *string  `json:"condition,omitempty"` // For conditional edges
}

type EdgeType string

const (
	EdgeTypeDefault     EdgeType = "default"
	EdgeTypeConditional EdgeType = "conditional"
	EdgeTypeFallback    EdgeType = "fallback"
	EdgeTypeParallel    EdgeType = "parallel"
)

// Strategy defines adaptive execution policies for a node.
type Strategy struct {
	RetryPolicy  RetryPolicy  `json:"retry_policy"`
	ModelOptions ModelOptions `json:"model_options"`
}

type RetryPolicy struct {
	MaxAttempts  int               `json:"max_attempts"`
	StrategyType RetryStrategyType `json:"strategy_type"`
}

type RetryStrategyType string

const (
	RetrySameModel        RetryStrategyType = "retry_same_model"
	RetryAlternativeModel RetryStrategyType = "retry_alternative_model"
	RetryPromptAdjustment RetryStrategyType = "retry_prompt_adjustment"
	RetryFallbackNode     RetryStrategyType = "fallback_node"
)

type ModelOptions struct {
	Capabilities     ModelCapabilities `json:"capabilities,omitempty"`
	PreferredModels  []string          `json:"preferred_models,omitempty"`
	OptimizationMode OptimizationMode  `json:"optimization_mode,omitempty"`
}

type ModelCapabilities struct {
	ReqReasoningDepth string `json:"req_reasoning_depth,omitempty"` // e.g. "high", "medium", "low"
	ReqDeterministic  bool   `json:"req_deterministic,omitempty"`
	MaxCostScore      int    `json:"max_cost_score,omitempty"` // 1-10 scale?
}

type OptimizationMode string

const (
	OptModeDeterministicStrict OptimizationMode = "deterministic_strict"
	OptModeCostOptimized       OptimizationMode = "cost_optimized"
	OptModeLatencyOptimized    OptimizationMode = "latency_optimized"
	OptModeQualityOptimized    OptimizationMode = "quality_optimized"
)
