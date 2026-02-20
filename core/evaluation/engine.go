package evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Evaluator defines the interface for the runtime scoring pipeline.
type Evaluator struct {
	ResultsDir  string
	FeedbackDir string
}

// NewEvaluator creates a new evaluation engine with default paths.
func NewEvaluator() *Evaluator {
	return &Evaluator{
		ResultsDir:  "evaluation/results",
		FeedbackDir: "evaluation/feedback",
	}
}

// ScoreRun evaluates a completed agent execution.
func (e *Evaluator) ScoreRun(ctx context.Context, test *TestDefinition, runID string, result string, retrievedChunks []string, latency time.Duration, tokens int) (*ScoringResult, error) {
	res := &ScoringResult{
		RunID:              runID,
		Timestamp:          time.Now().UTC(),
		Latency:            float64(latency.Milliseconds()),
		TokenUsage:         tokens,
		StructuralValidity: 1.0,
	}

	// 1. Grounding Validator: Compare answer citations to retrieved RAG chunks.
	res.Grounding = e.validateGrounding(test, result, retrievedChunks)
	if res.Grounding < 0.8 && len(retrievedChunks) > 0 {
		res.HallucinationAlert = true
		res.DetailedLog = append(res.DetailedLog, "Hallucination Risk: Answer claims facts not supported by retrieved chunks or has missing citations.")
	}

	// 2. Policy Scoring: Check against policy constraints
	res.PolicyCompliance = e.validatePolicy(test, result)
	if res.PolicyCompliance < 1.0 {
		res.PolicyViolationRisk = true
		res.DetailedLog = append(res.DetailedLog, "Policy violation risk detected.")
	}

	// 3. Tool Use Validation
	res.ToolCorrectness = e.validateToolUse(test, result)

	// Calculate aggregate score
	res.Score = (res.Grounding*0.4 + res.PolicyCompliance*0.3 + res.ToolCorrectness*0.2 + res.StructuralValidity*0.1)

	// Persist the result
	if err := e.PersistResult(res); err != nil {
		return res, fmt.Errorf("failed to persist result: %w", err)
	}

	return res, nil
}

func (e *Evaluator) validateGrounding(test *TestDefinition, result string, chunks []string) float64 {
	if len(test.RAGExpectations) == 0 {
		return 1.0
	}

	score := 1.0
	// Check for citations (e.g., [1], [2]) if we have chunks
	if len(chunks) > 0 {
		// Very simple citation check
		hasCitations := strings.Contains(result, "[") && strings.Contains(result, "]")
		if !hasCitations {
			score -= 0.3
		}
	}

	// Check if result contains keywords from expectations
	for _, exp := range test.RAGExpectations {
		if !strings.Contains(strings.ToLower(result), strings.ToLower(exp)) {
			score -= 0.1
		}
	}

	if score < 0 {
		score = 0
	}
	return score
}

func (e *Evaluator) validatePolicy(test *TestDefinition, result string) float64 {
	// Simple constraint check for demo
	score := 1.0
	for _, constraint := range test.PolicyConstraints {
		if strings.Contains(strings.ToLower(result), strings.ToLower(constraint)) {
			// If a forbidden word or concept is found (demo logic)
			score -= 0.5
		}
	}
	return score
}

func (e *Evaluator) validateToolUse(test *TestDefinition, result string) float64 {
	// In a real scenario, this would check the tool call logs from the runner.
	return 1.0
}

// PersistResult saves the scoring result to /evaluation/results/*.json
func (e *Evaluator) PersistResult(res *ScoringResult) error {
	// Ensure directories exist (just in case)
	if err := os.MkdirAll(e.ResultsDir, 0755); err != nil {
		return err
	}

	path := filepath.Join(e.ResultsDir, fmt.Sprintf("%s_%d.json", res.RunID, res.Timestamp.Unix()))
	data, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// PersistFeedback saves feedback to /evaluation/feedback/*.json
func (e *Evaluator) PersistFeedback(f *Feedback) error {
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
	// Ensure directories exist
	if err := os.MkdirAll(e.FeedbackDir, 0755); err != nil {
		return err
	}

	path := filepath.Join(e.FeedbackDir, fmt.Sprintf("%s_feedback.json", f.RunID))
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
