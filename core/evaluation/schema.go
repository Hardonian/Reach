package evaluation

import (
	"time"
)

// Difficulty defines the complexity level of a test.
type Difficulty string

const (
	DifficultyEasy   Difficulty = "easy"
	DifficultyMedium Difficulty = "medium"
	DifficultyHard   Difficulty = "hard"
)

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

// ScoringResult represents the output of the runtime scoring pipeline.
type ScoringResult struct {
	RunID               string    `json:"run_id"`
	Timestamp           time.Time `json:"timestamp"`
	Score               float64   `json:"score"` // Aggregate score (0-1)
	Grounding           float64   `json:"grounding"`
	PolicyCompliance    float64   `json:"policy_compliance"`
	ToolCorrectness     float64   `json:"tool_correctness"`
	StructuralValidity  float64   `json:"structural_validity"`
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
	UserRating            int                   `json:"user_rating"` // 1-5
	ConfidenceScore       float64               `json:"confidence_score"`
	FailureClassification FailureClassification `json:"failure_classification,omitempty"`
	Comment               string                `json:"comment,omitempty"`
	CreatedAt             time.Time             `json:"created_at"`
}
