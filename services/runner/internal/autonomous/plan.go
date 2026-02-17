package autonomous

import (
	"context"
	"encoding/json"
)

type OrchestrationBlueprint struct {
	Plan           PlanDetails    `json:"orchestration_plan"`
	SpawnTree      []SpawnNode    `json:"spawn_tree"`
	CapabilityPlan CapabilityPlan `json:"capability_plan"`
	NodeRouting    NodeRouting    `json:"node_routing"`
	PolicyTrace    []PolicyTrace  `json:"policy_trace"`
	Budget         Budget         `json:"budget"`
	Timeouts       map[string]int `json:"timeouts"`
	Observability  Observability  `json:"observability"`
	FailureModel   FailureModel   `json:"failure_model"`
}

type PlanDetails struct {
	Phases              []Phase `json:"phases"`
	Description         string  `json:"description"`
	EstimatedComplexity string  `json:"estimated_complexity"`
	RequiresInstall     bool    `json:"requires_install"`
}

type Phase struct {
	ID           string   `json:"id"`
	Description  string   `json:"description"`
	Steps        []string `json:"steps"` // Simplified for now, or map[string]any
	Dependencies []string `json:"dependencies"`
}

type SpawnNode struct {
	ID        string      `json:"id"`
	ParentID  string      `json:"parent_id,omitempty"`
	AgentType string      `json:"agent_type"`
	Children  []SpawnNode `json:"children,omitempty"`
}

type CapabilityPlan struct {
	RequiredCapabilities []string `json:"required_capabilities"`
	SideEffectTypes      []string `json:"side_effect_types"`
	TierRequired         string   `json:"tier_required"`
	RiskLevel            string   `json:"risk_level"`
}

type NodeRouting struct {
	Strategy         string            `json:"strategy"`
	AgentAssignments []AgentAssignment `json:"agent_assignments"`
}

type AgentAssignment struct {
	AgentID string `json:"agent_id"`
	NodeID  string `json:"node_id"`
}

type PolicyTrace struct {
	DecisionID string `json:"decision_id"`
	PolicyID   string `json:"policy_id"`
	Outcome    string `json:"outcome"`
	Reason     string `json:"reason"`
}

type Budget struct {
	MaxSpawnDepth      int `json:"max_spawn_depth"`
	MaxChildrenPerNode int `json:"max_children_per_node"`
	EstimatedToolCalls int `json:"estimated_tool_calls"`
	RetryLimit         int `json:"retry_limit"`
}

type Observability struct {
	EventsEmitted  []string `json:"events_emitted"`
	MetricsTracked []string `json:"metrics_tracked"`
}

type FailureModel struct {
	PossibleFailures []string `json:"possible_failures"`
	FallbackStrategy string   `json:"fallback_strategy"`
}

// Planner defines the interface for generating orchestration plans.
type Planner interface {
	Generate(ctx context.Context, sessionContext json.RawMessage, objective string) (*OrchestrationBlueprint, error)
}
