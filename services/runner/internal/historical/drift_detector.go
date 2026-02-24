// Package historical provides historical intelligence capabilities for Reach runs.
package historical

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// DRIFT DETECTOR - Core Data Structures
// ============================================================================

// DriftReport represents a comprehensive drift analysis report.
type DriftReport struct {
	PipelineID        string            `json:"pipeline_id"`
	AnalysisWindow    TimeWindow        `json:"analysis_window"`
	GeneratedAt       time.Time         `json:"generated_at"`
	StepProofVariance VarianceMetric    `json:"step_proof_variance"`
	Reproducibility   TrendMetric       `json:"reproducibility"`
	TrustScore        TrendMetric       `json:"trust_score"`
	ChaosSensitivity  TrendMetric       `json:"chaos_sensitivity"`
	StepVolatility    []VolatilityEntry `json:"step_volatility"`
	Alerts            []DriftAlert      `json:"alerts"`
	Summary           DriftSummary      `json:"summary"`
}

// TimeWindow represents a time range for analysis.
type TimeWindow struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
	Days  int       `json:"days"`
}

// VarianceMetric tracks variance statistics.
type VarianceMetric struct {
	Mean        float64     `json:"mean"`
	Variance    float64     `json:"variance"`
	StdDev      float64     `json:"std_dev"`
	Min         float64     `json:"min"`
	Max         float64     `json:"max"`
	SampleCount int         `json:"sample_count"`
	DataPoints  []DataPoint `json:"data_points"`
}

// TrendMetric tracks a metric's trend over time.
type TrendMetric struct {
	Name          string      `json:"name"`
	Values        []DataPoint `json:"values"`
	Slope         float64     `json:"slope"`     // Trend direction
	R2            float64     `json:"r_squared"` // Goodness of fit
	Trend         string      `json:"trend"`     // "improving", "degrading", "stable"
	ChangePercent float64     `json:"change_percent"`
}

// DataPoint represents a single data point in a time series.
type DataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	RunID     string    `json:"run_id,omitempty"`
}

// VolatilityEntry represents volatility for a specific step.
type VolatilityEntry struct {
	StepKey     string    `json:"step_key"`
	Volatility  float64   `json:"volatility"`
	ChangeCount int       `json:"change_count"`
	LastChanged time.Time `json:"last_changed"`
	RiskLevel   string    `json:"risk_level"` // "low", "medium", "high"
}

// DriftAlert represents a detected drift condition.
type DriftAlert struct {
	Type      string    `json:"type"`     // "variance_high", "trend_degrading", "volatility_spike"
	Severity  string    `json:"severity"` // "info", "warning", "critical"
	Message   string    `json:"message"`
	StepKey   string    `json:"step_key,omitempty"`
	Value     float64   `json:"value,omitempty"`
	Threshold float64   `json:"threshold,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// DriftSummary provides a high-level summary.
type DriftSummary struct {
	OverallHealth  string  `json:"overall_health"` // "healthy", "degraded", "critical"
	RiskScore      float64 `json:"risk_score"`     // 0-100
	Recommendation string  `json:"recommendation"`
	RunsAnalyzed   int     `json:"runs_analyzed"`
	StepsAnalyzed  int     `json:"steps_analyzed"`
}

// ============================================================================
// DRIFT DETECTOR - Storage Layer
// ============================================================================

// DriftDetector analyzes historical runs for drift patterns.
type DriftDetector struct {
	db      *sql.DB
	mu      sync.RWMutex
	dataDir string
	index   *LineageIndex
}

// NewDriftDetector creates a new drift detector.
func NewDriftDetector(dataDir string, index *LineageIndex) (*DriftDetector, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "drift_metrics.db")
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	detector := &DriftDetector{db: db, dataDir: dataDir, index: index}
	if err := detector.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return detector, nil
}

// migrate creates the necessary tables for drift metrics.
func (d *DriftDetector) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS run_metrics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			run_id TEXT NOT NULL,
			pipeline_id TEXT,
			timestamp TIMESTAMP NOT NULL,
			reproducibility_score REAL,
			trust_score REAL,
			chaos_sensitivity REAL,
			step_count INTEGER,
			fingerprint TEXT,
			UNIQUE(run_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_pipeline ON run_metrics(pipeline_id)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON run_metrics(timestamp)`,
		`CREATE TABLE IF NOT EXISTS step_proofs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			run_id TEXT NOT NULL,
			step_key TEXT NOT NULL,
			step_index INTEGER,
			proof_hash TEXT NOT NULL,
			timestamp TIMESTAMP NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_proofs_step_key ON step_proofs(step_key)`,
		`CREATE INDEX IF NOT EXISTS idx_proofs_run ON step_proofs(run_id)`,
		`CREATE TABLE IF NOT EXISTS drift_baselines (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pipeline_id TEXT NOT NULL,
			run_id TEXT NOT NULL,
			frozen_at TIMESTAMP NOT NULL,
			metrics_json TEXT NOT NULL,
			UNIQUE(pipeline_id)
		)`,
	}
	for _, q := range queries {
		if _, err := d.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection.
func (d *DriftDetector) Close() error {
	return d.db.Close()
}

// ============================================================================
// METRICS RECORDING
// ============================================================================

// RecordRunMetrics records metrics for a completed run.
func (d *DriftDetector) RecordRunMetrics(ctx context.Context, runID, pipelineID string,
	reproScore, trustScore, chaosSens float64, stepCount int, fingerprint string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO run_metrics 
		(run_id, pipeline_id, timestamp, reproducibility_score, trust_score, chaos_sensitivity, step_count, fingerprint)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, runID, pipelineID, time.Now().UTC(), reproScore, trustScore, chaosSens, stepCount, fingerprint)
	return err
}

// RecordStepProof records a step proof for variance tracking.
func (d *DriftDetector) RecordStepProof(ctx context.Context, runID, stepKey string, stepIndex int, proofHash string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.ExecContext(ctx, `
		INSERT INTO step_proofs (run_id, step_key, step_index, proof_hash, timestamp)
		VALUES (?, ?, ?, ?, ?)
	`, runID, stepKey, stepIndex, proofHash, time.Now().UTC())
	return err
}

// ============================================================================
// DRIFT ANALYSIS
// ============================================================================

// AnalyzeDrift performs comprehensive drift analysis for a pipeline.
func (d *DriftDetector) AnalyzeDrift(ctx context.Context, pipelineID string, windowDays int) (*DriftReport, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if windowDays <= 0 {
		windowDays = 30
	}

	now := time.Now().UTC()
	start := now.AddDate(0, 0, -windowDays)
	window := TimeWindow{Start: start, End: now, Days: windowDays}

	report := &DriftReport{
		PipelineID:     pipelineID,
		AnalysisWindow: window,
		GeneratedAt:    now,
		Alerts:         []DriftAlert{},
	}

	// 1. Compute step proof variance
	variance, err := d.computeStepProofVariance(ctx, pipelineID, start, now)
	if err == nil {
		report.StepProofVariance = variance
	}

	// 2. Compute reproducibility trend
	reproTrend, err := d.computeTrendMetric(ctx, pipelineID, "reproducibility_score", start, now)
	if err == nil {
		report.Reproducibility = reproTrend
	}

	// 3. Compute trust score trend
	trustTrend, err := d.computeTrendMetric(ctx, pipelineID, "trust_score", start, now)
	if err == nil {
		report.TrustScore = trustTrend
	}

	// 4. Compute chaos sensitivity trend
	chaosTrend, err := d.computeTrendMetric(ctx, pipelineID, "chaos_sensitivity", start, now)
	if err == nil {
		report.ChaosSensitivity = chaosTrend
	}

	// 5. Compute step volatility
	volatility, err := d.computeStepVolatility(ctx, pipelineID, start, now)
	if err == nil {
		report.StepVolatility = volatility
	}

	// 6. Generate alerts
	report.Alerts = d.generateAlerts(report)

	// 7. Compute summary
	report.Summary = d.computeSummary(report)

	return report, nil
}

// computeStepProofVariance computes variance metrics for step proofs.
func (d *DriftDetector) computeStepProofVariance(ctx context.Context, pipelineID string, start, end time.Time) (VarianceMetric, error) {
	// Get all proof hashes for the pipeline in the time window
	rows, err := d.db.QueryContext(ctx, `
		SELECT sp.proof_hash, sp.timestamp, sp.run_id
		FROM step_proofs sp
		JOIN run_metrics rm ON sp.run_id = rm.run_id
		WHERE rm.pipeline_id = ? AND sp.timestamp >= ? AND sp.timestamp <= ?
		ORDER BY sp.timestamp ASC
	`, pipelineID, start, end)
	if err != nil {
		return VarianceMetric{}, err
	}
	defer rows.Close()

	// Count unique proofs per time bucket (daily)
	buckets := make(map[string]map[string]bool) // day -> set of proof hashes
	var dataPoints []DataPoint
	var allValues []float64

	for rows.Next() {
		var proofHash string
		var timestamp time.Time
		var runID string
		if err := rows.Scan(&proofHash, &timestamp, &runID); err != nil {
			continue
		}
		day := timestamp.Format("2006-01-02")
		if buckets[day] == nil {
			buckets[day] = make(map[string]bool)
		}
		buckets[day][proofHash] = true
	}

	// Convert to variance metric
	for day, proofs := range buckets {
		t, _ := time.Parse("2006-01-02", day)
		uniqueCount := float64(len(proofs))
		dataPoints = append(dataPoints, DataPoint{Timestamp: t, Value: uniqueCount})
		allValues = append(allValues, uniqueCount)
	}

	if len(allValues) == 0 {
		return VarianceMetric{SampleCount: 0}, nil
	}

	// Compute statistics
	mean := meanValue(allValues)
	variance := varianceValue(allValues, mean)
	stdDev := math.Sqrt(variance)

	sort.Slice(dataPoints, func(i, j int) bool {
		return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
	})

	return VarianceMetric{
		Mean:        mean,
		Variance:    variance,
		StdDev:      stdDev,
		Min:         minValue(allValues),
		Max:         maxValue(allValues),
		SampleCount: len(allValues),
		DataPoints:  dataPoints,
	}, nil
}

// computeTrendMetric computes a trend metric for a specific column.
func (d *DriftDetector) computeTrendMetric(ctx context.Context, pipelineID, column string, start, end time.Time) (TrendMetric, error) {
	query := fmt.Sprintf(`
		SELECT timestamp, %s, run_id
		FROM run_metrics
		WHERE pipeline_id = ? AND timestamp >= ? AND timestamp <= ? AND %s IS NOT NULL
		ORDER BY timestamp ASC
	`, column, column)

	rows, err := d.db.QueryContext(ctx, query, pipelineID, start, end)
	if err != nil {
		return TrendMetric{}, err
	}
	defer rows.Close()

	var dataPoints []DataPoint
	var values []float64

	for rows.Next() {
		var timestamp time.Time
		var value float64
		var runID string
		if err := rows.Scan(&timestamp, &value, &runID); err != nil {
			continue
		}
		dataPoints = append(dataPoints, DataPoint{Timestamp: timestamp, Value: value, RunID: runID})
		values = append(values, value)
	}

	if len(values) < 2 {
		return TrendMetric{Name: column, Values: dataPoints, Trend: "insufficient_data"}, nil
	}

	// Linear regression for trend
	slope, r2 := linearRegression(dataPoints)

	// Determine trend direction
	trend := "stable"
	if slope > 0.001 {
		trend = "improving"
	} else if slope < -0.001 {
		trend = "degrading"
	}

	// Calculate percent change
	changePercent := 0.0
	if len(values) >= 2 && values[0] != 0 {
		changePercent = ((values[len(values)-1] - values[0]) / math.Abs(values[0])) * 100
	}

	return TrendMetric{
		Name:          column,
		Values:        dataPoints,
		Slope:         slope,
		R2:            r2,
		Trend:         trend,
		ChangePercent: changePercent,
	}, nil
}

// computeStepVolatility computes volatility for each step.
func (d *DriftDetector) computeStepVolatility(ctx context.Context, pipelineID string, start, end time.Time) ([]VolatilityEntry, error) {
	// Get proof changes per step
	rows, err := d.db.QueryContext(ctx, `
		SELECT step_key, COUNT(DISTINCT proof_hash) as change_count, MAX(timestamp) as last_changed
		FROM step_proofs sp
		JOIN run_metrics rm ON sp.run_id = rm.run_id
		WHERE rm.pipeline_id = ? AND sp.timestamp >= ? AND sp.timestamp <= ?
		GROUP BY step_key
		ORDER BY change_count DESC
	`, pipelineID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []VolatilityEntry
	for rows.Next() {
		var stepKey string
		var changeCount int
		var lastChanged time.Time
		if err := rows.Scan(&stepKey, &changeCount, &lastChanged); err != nil {
			continue
		}

		// Volatility score: higher change count = higher volatility
		volatility := float64(changeCount) / 10.0 // Normalize
		if volatility > 1.0 {
			volatility = 1.0
		}

		// Risk level
		riskLevel := "low"
		if volatility > 0.3 {
			riskLevel = "medium"
		}
		if volatility > 0.6 {
			riskLevel = "high"
		}

		entries = append(entries, VolatilityEntry{
			StepKey:     stepKey,
			Volatility:  volatility,
			ChangeCount: changeCount,
			LastChanged: lastChanged,
			RiskLevel:   riskLevel,
		})
	}

	// Sort by volatility descending
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Volatility > entries[j].Volatility
	})

	return entries, nil
}

// generateAlerts generates alerts based on the drift report.
func (d *DriftDetector) generateAlerts(report *DriftReport) []DriftAlert {
	var alerts []DriftAlert
	now := time.Now().UTC()

	// Check step proof variance
	if report.StepProofVariance.StdDev > 2.0 {
		alerts = append(alerts, DriftAlert{
			Type:      "variance_high",
			Severity:  "warning",
			Message:   fmt.Sprintf("Step proof variance is high (stddev: %.2f)", report.StepProofVariance.StdDev),
			Value:     report.StepProofVariance.StdDev,
			Threshold: 2.0,
			Timestamp: now,
		})
	}

	// Check reproducibility trend
	if report.Reproducibility.Trend == "degrading" {
		alerts = append(alerts, DriftAlert{
			Type:      "trend_degrading",
			Severity:  "warning",
			Message:   fmt.Sprintf("Reproducibility is degrading (%.1f%% change)", report.Reproducibility.ChangePercent),
			Value:     report.Reproducibility.ChangePercent,
			Timestamp: now,
		})
	}

	// Check trust score trend
	if report.TrustScore.Trend == "degrading" {
		alerts = append(alerts, DriftAlert{
			Type:      "trend_degrading",
			Severity:  "warning",
			Message:   fmt.Sprintf("Trust score is degrading (%.1f%% change)", report.TrustScore.ChangePercent),
			Value:     report.TrustScore.ChangePercent,
			Timestamp: now,
		})
	}

	// Check chaos sensitivity
	if report.ChaosSensitivity.Trend == "degrading" && report.ChaosSensitivity.Slope > 0.01 {
		alerts = append(alerts, DriftAlert{
			Type:      "chaos_sensitivity_high",
			Severity:  "critical",
			Message:   fmt.Sprintf("Chaos sensitivity is increasing (%.1f%% change)", report.ChaosSensitivity.ChangePercent),
			Value:     report.ChaosSensitivity.ChangePercent,
			Timestamp: now,
		})
	}

	// Check step volatility
	for _, entry := range report.StepVolatility {
		if entry.RiskLevel == "high" {
			alerts = append(alerts, DriftAlert{
				Type:      "volatility_spike",
				Severity:  "warning",
				Message:   fmt.Sprintf("Step '%s' has high volatility (%.2f)", entry.StepKey, entry.Volatility),
				StepKey:   entry.StepKey,
				Value:     entry.Volatility,
				Threshold: 0.6,
				Timestamp: now,
			})
		}
	}

	return alerts
}

// computeSummary computes the overall summary.
func (d *DriftDetector) computeSummary(report *DriftReport) DriftSummary {
	summary := DriftSummary{
		OverallHealth: "healthy",
		RiskScore:     0,
	}

	// Count runs and steps analyzed
	summary.RunsAnalyzed = len(report.Reproducibility.Values)
	summary.StepsAnalyzed = len(report.StepVolatility)

	// Compute risk score (0-100)
	riskScore := 0.0

	// Variance contribution
	if report.StepProofVariance.StdDev > 1.0 {
		riskScore += math.Min(report.StepProofVariance.StdDev*10, 30)
	}

	// Trend contribution
	if report.Reproducibility.Trend == "degrading" {
		riskScore += 20
	}
	if report.TrustScore.Trend == "degrading" {
		riskScore += 15
	}
	if report.ChaosSensitivity.Trend == "degrading" {
		riskScore += 15
	}

	// Volatility contribution
	highVolatilityCount := 0
	for _, entry := range report.StepVolatility {
		if entry.RiskLevel == "high" {
			highVolatilityCount++
		}
	}
	riskScore += float64(highVolatilityCount) * 5

	// Alert contribution
	for _, alert := range report.Alerts {
		switch alert.Severity {
		case "critical":
			riskScore += 10
		case "warning":
			riskScore += 5
		}
	}

	summary.RiskScore = math.Min(riskScore, 100)

	// Determine overall health
	if summary.RiskScore > 70 {
		summary.OverallHealth = "critical"
	} else if summary.RiskScore > 40 {
		summary.OverallHealth = "degraded"
	}

	// Generate recommendation
	switch summary.OverallHealth {
	case "critical":
		summary.Recommendation = "Immediate action required. Review high-volatility steps and investigate degrading trends."
	case "degraded":
		summary.Recommendation = "Monitor closely. Consider freezing a baseline and investigating recent changes."
	default:
		summary.Recommendation = "System is healthy. Continue regular monitoring."
	}

	return summary
}

// ============================================================================
// REPORT OUTPUT
// ============================================================================

// WriteReportJSON writes the drift report to a JSON file.
func (d *DriftDetector) WriteReportJSON(report *DriftReport, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// WriteReportMarkdown writes the drift report to a Markdown file.
func (d *DriftDetector) WriteReportMarkdown(report *DriftReport, path string) error {
	var md strings.Builder

	md.WriteString(fmt.Sprintf("# Drift Analysis Report\n\n"))
	md.WriteString(fmt.Sprintf("**Pipeline:** %s\n\n", report.PipelineID))
	md.WriteString(fmt.Sprintf("**Analysis Window:** %s to %s (%d days)\n\n",
		report.AnalysisWindow.Start.Format("2006-01-02"),
		report.AnalysisWindow.End.Format("2006-01-02"),
		report.AnalysisWindow.Days))
	md.WriteString(fmt.Sprintf("**Generated:** %s\n\n", report.GeneratedAt.Format(time.RFC3339)))

	// Summary
	md.WriteString("## Summary\n\n")
	md.WriteString(fmt.Sprintf("- **Overall Health:** %s\n", report.Summary.OverallHealth))
	md.WriteString(fmt.Sprintf("- **Risk Score:** %.1f/100\n", report.Summary.RiskScore))
	md.WriteString(fmt.Sprintf("- **Runs Analyzed:** %d\n", report.Summary.RunsAnalyzed))
	md.WriteString(fmt.Sprintf("- **Steps Analyzed:** %d\n", report.Summary.StepsAnalyzed))
	md.WriteString(fmt.Sprintf("- **Recommendation:** %s\n\n", report.Summary.Recommendation))

	// Metrics
	md.WriteString("## Metrics\n\n")
	md.WriteString("### Step Proof Variance\n\n")
	md.WriteString(fmt.Sprintf("- Mean: %.4f\n", report.StepProofVariance.Mean))
	md.WriteString(fmt.Sprintf("- Std Dev: %.4f\n", report.StepProofVariance.StdDev))
	md.WriteString(fmt.Sprintf("- Min: %.4f\n", report.StepProofVariance.Min))
	md.WriteString(fmt.Sprintf("- Max: %.4f\n\n", report.StepProofVariance.Max))

	md.WriteString("### Trends\n\n")
	md.WriteString(fmt.Sprintf("| Metric | Trend | Change | R² |\n"))
	md.WriteString("|--------|-------|--------|----|\n")
	md.WriteString(fmt.Sprintf("| Reproducibility | %s | %.1f%% | %.3f |\n",
		report.Reproducibility.Trend, report.Reproducibility.ChangePercent, report.Reproducibility.R2))
	md.WriteString(fmt.Sprintf("| Trust Score | %s | %.1f%% | %.3f |\n",
		report.TrustScore.Trend, report.TrustScore.ChangePercent, report.TrustScore.R2))
	md.WriteString(fmt.Sprintf("| Chaos Sensitivity | %s | %.1f%% | %.3f |\n\n",
		report.ChaosSensitivity.Trend, report.ChaosSensitivity.ChangePercent, report.ChaosSensitivity.R2))

	// Step Volatility
	if len(report.StepVolatility) > 0 {
		md.WriteString("### Step Volatility\n\n")
		md.WriteString("| Step Key | Volatility | Risk Level | Changes |\n")
		md.WriteString("|----------|------------|------------|--------|\n")
		for _, entry := range report.StepVolatility {
			md.WriteString(fmt.Sprintf("| %s | %.2f | %s | %d |\n",
				entry.StepKey, entry.Volatility, entry.RiskLevel, entry.ChangeCount))
		}
		md.WriteString("\n")
	}

	// Alerts
	if len(report.Alerts) > 0 {
		md.WriteString("## Alerts\n\n")
		for _, alert := range report.Alerts {
			md.WriteString(fmt.Sprintf("- **[%s]** %s\n", alert.Severity, alert.Message))
		}
		md.WriteString("\n")
	}

	return os.WriteFile(path, []byte(md.String()), 0o644)
}

// ============================================================================
// STATISTICAL HELPERS
// ============================================================================

func meanValue(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func varianceValue(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	return sum / float64(len(values)-1)
}

func minValue(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	min := values[0]
	for _, v := range values[1:] {
		if v < min {
			min = v
		}
	}
	return min
}

func maxValue(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values[1:] {
		if v > max {
			max = v
		}
	}
	return max
}

// linearRegression computes slope and R² for a time series.
func linearRegression(points []DataPoint) (slope, r2 float64) {
	if len(points) < 2 {
		return 0, 0
	}

	n := float64(len(points))

	// Convert timestamps to numeric (days since first point)
	t0 := points[0].Timestamp
	var sumX, sumY, sumXY, sumX2, sumY2 float64

	for _, p := range points {
		x := p.Timestamp.Sub(t0).Hours() / 24.0
		y := p.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
		sumY2 += y * y
	}

	// Slope
	denominator := n*sumX2 - sumX*sumX
	if denominator == 0 {
		return 0, 0
	}
	slope = (n*sumXY - sumX*sumY) / denominator

	// R²
	meanY := sumY / n
	var ssTotal, ssResidual float64
	for _, p := range points {
		x := p.Timestamp.Sub(t0).Hours() / 24.0
		y := p.Value
		yPred := meanY + slope*(x-sumX/n)
		ssTotal += (y - meanY) * (y - meanY)
		ssResidual += (y - yPred) * (y - yPred)
	}
	if ssTotal == 0 {
		return slope, 1.0
	}
	r2 = 1 - ssResidual/ssTotal

	return slope, r2
}
