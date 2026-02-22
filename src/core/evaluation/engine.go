package evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Evaluator defines the interface for the runtime scoring pipeline.
type Evaluator struct {
	ResultsDir  string
	FeedbackDir string
	HistoryDir  string
	Weights     ScoringWeights
	Thresholds  RegressionThresholds
}

// NewEvaluator creates a new evaluation engine with default paths.
func NewEvaluator() *Evaluator {
	dataRoot := os.Getenv("REACH_DATA_DIR")
	if dataRoot == "" {
		dataRoot = "data"
	}
	return &Evaluator{
		ResultsDir:  filepath.Join(dataRoot, "evaluation", "results"),
		FeedbackDir: filepath.Join(dataRoot, "evaluation", "feedback"),
		HistoryDir:  filepath.Join(dataRoot, "evaluation", "history"),
		Weights:     DefaultWeights(),
		Thresholds:  DefaultThresholds(),
	}
}

// ScoreRun evaluates a completed agent execution with configurable weights.
func (e *Evaluator) ScoreRun(ctx context.Context, test *TestDefinition, runID string, result string, retrievedChunks []string, latency time.Duration, tokens int) (*ScoringResult, error) {
	res := &ScoringResult{
		RunID:              runID,
		Timestamp:          time.Now().UTC(),
		Latency:            float64(latency.Milliseconds()),
		TokenUsage:         tokens,
		StructuralValidity: 1.0,
	}

	// 1. Grounding Validator
	res.Grounding = e.validateGrounding(test, result, retrievedChunks)
	if res.Grounding < 0.8 && len(retrievedChunks) > 0 {
		res.HallucinationAlert = true
		res.DetailedLog = append(res.DetailedLog, "Hallucination Risk: Answer claims facts not supported by retrieved chunks or has missing citations.")
	}

	// 2. Policy Scoring
	res.PolicyCompliance = e.validatePolicy(test, result)
	if res.PolicyCompliance < 1.0 {
		res.PolicyViolationRisk = true
		res.DetailedLog = append(res.DetailedLog, "Policy violation risk detected.")
	}

	// 3. Tool Use Validation
	res.ToolCorrectness = e.validateToolUse(test, result)

	// 4. Latency Score (normalized: <1s = 1.0, >10s = 0.0)
	latMs := float64(latency.Milliseconds())
	res.LatencyScore = math.Max(0, math.Min(1.0, 1.0-(latMs-1000)/9000))

	// 5. Token Efficiency Score (normalized: <500 = 1.0, >5000 = 0.0)
	res.TokenEfficiencyScore = math.Max(0, math.Min(1.0, 1.0-(float64(tokens)-500)/4500))

	// Calculate weighted aggregate score
	w := e.Weights
	res.Score = (res.Grounding*w.Grounding +
		res.PolicyCompliance*w.PolicyCompliance +
		res.ToolCorrectness*w.ToolCorrectness +
		res.LatencyScore*w.Latency +
		res.TokenEfficiencyScore*w.TokenEfficiency)

	// Persist the result
	if err := e.PersistResult(res); err != nil {
		return res, fmt.Errorf("failed to persist result: %w", err)
	}

	// Persist to history
	if err := e.PersistHistory(res); err != nil {
		res.DetailedLog = append(res.DetailedLog, fmt.Sprintf("Warning: failed to persist history: %v", err))
	}

	return res, nil
}

func (e *Evaluator) validateGrounding(test *TestDefinition, result string, chunks []string) float64 {
	if len(test.RAGExpectations) == 0 {
		return 1.0
	}

	score := 1.0
	if len(chunks) > 0 {
		hasCitations := strings.Contains(result, "[") && strings.Contains(result, "]")
		if !hasCitations {
			score -= 0.3
		}
	}

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
	score := 1.0
	for _, constraint := range test.PolicyConstraints {
		if strings.Contains(strings.ToLower(result), strings.ToLower(constraint)) {
			score -= 0.5
		}
	}
	if score < 0 {
		score = 0
	}
	return score
}

func (e *Evaluator) validateToolUse(test *TestDefinition, result string) float64 {
	return 1.0
}

// PersistResult saves the scoring result to results directory.
func (e *Evaluator) PersistResult(res *ScoringResult) error {
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

// PersistHistory appends a scoring result to the history ledger.
func (e *Evaluator) PersistHistory(res *ScoringResult) error {
	if err := os.MkdirAll(e.HistoryDir, 0755); err != nil {
		return err
	}

	dateStr := res.Timestamp.Format("2006-01-02")
	histPath := filepath.Join(e.HistoryDir, dateStr+".jsonl")

	data, err := json.Marshal(res)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(histPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(append(data, '\n'))
	return err
}

// PersistFeedback saves feedback to feedback directory.
func (e *Evaluator) PersistFeedback(f *Feedback) error {
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
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

// LoadHistory loads scoring results from the history ledger within a time window.
func (e *Evaluator) LoadHistory(windowDays int) ([]ScoringResult, error) {
	if _, err := os.Stat(e.HistoryDir); os.IsNotExist(err) {
		return nil, nil
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -windowDays)
	var results []ScoringResult

	entries, err := os.ReadDir(e.HistoryDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".jsonl") {
			continue
		}

		data, err := os.ReadFile(filepath.Join(e.HistoryDir, entry.Name()))
		if err != nil {
			continue
		}

		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var res ScoringResult
			if err := json.Unmarshal([]byte(line), &res); err != nil {
				continue
			}
			if res.Timestamp.After(cutoff) {
				results = append(results, res)
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Timestamp.Before(results[j].Timestamp)
	})

	return results, nil
}

// ComputeTrend computes a trend report for a given metric over a window.
func (e *Evaluator) ComputeTrend(metric string, windowDays int) (*TrendReport, error) {
	results, err := e.LoadHistory(windowDays)
	if err != nil {
		return nil, err
	}

	report := &TrendReport{
		Metric: metric,
		Window: fmt.Sprintf("%dd", windowDays),
		Min:    1.0,
		Max:    0.0,
	}

	for _, res := range results {
		val := extractMetric(res, metric)
		report.Points = append(report.Points, TrendPoint{
			Timestamp: res.Timestamp,
			Value:     val,
			RunID:     res.RunID,
		})
		report.Average += val
		if val < report.Min {
			report.Min = val
		}
		if val > report.Max {
			report.Max = val
		}
	}

	n := len(report.Points)
	if n == 0 {
		report.Min = 0
		report.Direction = "stable"
		return report, nil
	}

	report.Average /= float64(n)

	if n >= 4 {
		quarter := n / 4
		var firstAvg, lastAvg float64
		for i := 0; i < quarter; i++ {
			firstAvg += report.Points[i].Value
		}
		firstAvg /= float64(quarter)

		for i := n - quarter; i < n; i++ {
			lastAvg += report.Points[i].Value
		}
		lastAvg /= float64(quarter)

		delta := lastAvg - firstAvg
		if delta > 0.02 {
			report.Direction = "improving"
		} else if delta < -0.02 {
			report.Direction = "degrading"
		} else {
			report.Direction = "stable"
		}
	} else {
		report.Direction = "stable"
	}

	return report, nil
}

// CheckRegression compares the latest result against recent history.
func (e *Evaluator) CheckRegression(metric string, windowDays int) (RegressionSeverity, float64, error) {
	results, err := e.LoadHistory(windowDays)
	if err != nil {
		return "", 0, err
	}

	if len(results) < 2 {
		return "", 0, nil
	}

	latest := results[len(results)-1]
	baseline := 0.0
	for _, r := range results[:len(results)-1] {
		baseline += extractMetric(r, metric)
	}
	baseline /= float64(len(results) - 1)

	current := extractMetric(latest, metric)
	delta := current - baseline

	severity := e.Thresholds.ClassifyRegression(delta)
	return severity, delta, nil
}

func extractMetric(res ScoringResult, metric string) float64 {
	switch metric {
	case "grounding":
		return res.Grounding
	case "policy_compliance":
		return res.PolicyCompliance
	case "tool_correctness":
		return res.ToolCorrectness
	case "latency":
		return res.LatencyScore
	case "token_efficiency":
		return res.TokenEfficiencyScore
	case "score":
		return res.Score
	default:
		return res.Score
	}
}
