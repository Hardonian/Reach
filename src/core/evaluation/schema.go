package evaluation

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Difficulty defines the complexity level of a test.
type Difficulty string

const (
	DifficultyEasy   Difficulty = "easy"
	DifficultyMedium Difficulty = "medium"
	DifficultyHard   Difficulty = "hard"
)

// ScoringWeights defines configurable weights for each metric dimension.
type ScoringWeights struct {
	Grounding       float64 `json:"grounding"`
	PolicyCompliance float64 `json:"policy_compliance"`
	ToolCorrectness float64 `json:"tool_correctness"`
	Latency         float64 `json:"latency"`
	TokenEfficiency float64 `json:"token_efficiency"`
}

// DefaultWeights returns the standard scoring weights.
func DefaultWeights() ScoringWeights {
	return ScoringWeights{
		Grounding:        0.30,
		PolicyCompliance: 0.25,
		ToolCorrectness:  0.20,
		Latency:          0.15,
		TokenEfficiency:  0.10,
	}
}

// RegressionSeverity classifies the severity of a regression.
type RegressionSeverity string

const (
	SeverityWarning      RegressionSeverity = "warning"
	SeverityBlock        RegressionSeverity = "block"
	SeverityCriticalHalt RegressionSeverity = "critical_halt"
)

// RegressionThresholds defines at what delta each severity triggers.
type RegressionThresholds struct {
	WarningDelta      float64 `json:"warning_delta"`
	BlockDelta        float64 `json:"block_delta"`
	CriticalHaltDelta float64 `json:"critical_halt_delta"`
}

// DefaultThresholds returns standard regression thresholds.
func DefaultThresholds() RegressionThresholds {
	return RegressionThresholds{
		WarningDelta:      -0.05,
		BlockDelta:        -0.10,
		CriticalHaltDelta: -0.20,
	}
}

// ClassifyRegression returns the severity for a given score delta.
func (t RegressionThresholds) ClassifyRegression(delta float64) RegressionSeverity {
	if delta <= t.CriticalHaltDelta {
		return SeverityCriticalHalt
	}
	if delta <= t.BlockDelta {
		return SeverityBlock
	}
	if delta <= t.WarningDelta {
		return SeverityWarning
	}
	return "" // no regression
}

// TestDefinition represents the schema for a native test registry entry.
type TestDefinition struct {
	ID                string            `json:"id"`
	Input             string            `json:"input"`
	ExpectedBehavior  string            `json:"expected_behavior"`
	IdealAnswer       string            `json:"ideal_answer,omitempty"`
	PolicyConstraints []string          `json:"policy_constraints"`
	RAGExpectations   []string          `json:"rag_expectations"`
	ToolExpectations  []string          `json:"tool_expectations"`
	Difficulty        Difficulty        `json:"difficulty"`
	Metadata          map[string]string `json:"metadata,omitempty"`
}

// ValidateTestDefinition checks that a TestDefinition has required fields.
func ValidateTestDefinition(td *TestDefinition) error {
	if td.ID == "" {
		return fmt.Errorf("test definition missing required field: id")
	}
	if td.Input == "" {
		return fmt.Errorf("test definition %q missing required field: input", td.ID)
	}
	return nil
}

// ValidateTestDefinitionJSON validates raw JSON against the test schema.
func ValidateTestDefinitionJSON(data []byte) (*TestDefinition, error) {
	var td TestDefinition
	if err := json.Unmarshal(data, &td); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if err := ValidateTestDefinition(&td); err != nil {
		return nil, err
	}
	return &td, nil
}

// LoadTestDefinitionFile loads and validates a test definition from a JSON file.
func LoadTestDefinitionFile(path string) (*TestDefinition, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read test file %s: %w", path, err)
	}
	return ValidateTestDefinitionJSON(data)
}

// ScoringResult represents the output of the runtime scoring pipeline.
type ScoringResult struct {
	RunID               string    `json:"run_id"`
	Timestamp           time.Time `json:"timestamp"`
	Score               float64   `json:"score"`
	Grounding           float64   `json:"grounding"`
	PolicyCompliance    float64   `json:"policy_compliance"`
	ToolCorrectness     float64   `json:"tool_correctness"`
	StructuralValidity  float64   `json:"structural_validity"`
	LatencyScore        float64   `json:"latency_score"`
	TokenEfficiencyScore float64  `json:"token_efficiency_score"`
	Latency             float64   `json:"latency_ms"`
	TokenUsage          int       `json:"token_usage"`
	HallucinationAlert  bool      `json:"hallucination_alert"`
	PolicyViolationRisk bool      `json:"policy_violation_risk"`
	DetailedLog         []string  `json:"detailed_log,omitempty"`
}

// FailureClassification classifies why a run failed.
type FailureClassification string

const (
	FailureConfig        FailureClassification = "config"
	FailureRetrieval     FailureClassification = "retrieval"
	FailureHallucination FailureClassification = "hallucination"
	FailurePermission    FailureClassification = "permission"
	FailureRuntime       FailureClassification = "runtime"
	FailureUnknown       FailureClassification = "unknown"
)

// Feedback represents user or model self-reported feedback.
type Feedback struct {
	RunID                 string                `json:"run_id"`
	UserRating            int                   `json:"user_rating"`
	ConfidenceScore       float64               `json:"confidence_score"`
	FailureClassification FailureClassification `json:"failure_classification,omitempty"`
	Comment               string                `json:"comment,omitempty"`
	CreatedAt             time.Time             `json:"created_at"`
}

// TrendPoint represents a single data point in a metric trend.
type TrendPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	RunID     string    `json:"run_id"`
}

// TrendReport summarizes metric values over time.
type TrendReport struct {
	Metric    string       `json:"metric"`
	Window    string       `json:"window"`
	Points    []TrendPoint `json:"points"`
	Average   float64      `json:"average"`
	Min       float64      `json:"min"`
	Max       float64      `json:"max"`
	Direction string       `json:"direction"` // improving, degrading, stable
}
