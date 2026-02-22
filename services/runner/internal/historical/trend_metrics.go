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
// TREND METRICS - Core Data Structures
// ============================================================================

// TrendMetricsReport represents a comprehensive trend analysis report.
type TrendMetricsReport struct {
	PipelineID            string              `json:"pipeline_id"`
	GeneratedAt           time.Time           `json:"generated_at"`
	TimeWindow            TimeWindow          `json:"time_window"`
	MeanReproducibility   float64             `json:"mean_reproducibility"`
	TrustVolatilityIndex  float64             `json:"trust_volatility_index"`
	StepStabilityPercentile map[string]float64 `json:"step_stability_percentile"`
	RunsAnalyzed          int                 `json:"runs_analyzed"`
	MetricHistory         MetricHistory       `json:"metric_history"`
	StepRankings          []StepRanking       `json:"step_rankings"`
	Anomalies             []MetricAnomaly     `json:"anomalies"`
	Forecast              *MetricForecast     `json:"forecast,omitempty"`
}

// MetricHistory contains historical metric values.
type MetricHistory struct {
	Reproducibility []DataPoint `json:"reproducibility"`
	TrustScore      []DataPoint `json:"trust_score"`
	ChaosSensitivity []DataPoint `json:"chaos_sensitivity"`
	StepCount       []DataPoint `json:"step_count"`
}

// StepRanking represents a step's stability ranking.
type StepRanking struct {
	StepKey           string    `json:"step_key"`
	StabilityScore    float64   `json:"stability_score"`
	Percentile        float64   `json:"percentile"`
	Occurrences       int       `json:"occurrences"`
	LastSeen          time.Time `json:"last_seen"`
	VarianceFromNorm  float64   `json:"variance_from_norm"`
}

// MetricAnomaly represents a detected anomaly in metrics.
type MetricAnomaly struct {
	Type          string    `json:"type"`          // "spike", "drop", "trend_break"
	Metric        string    `json:"metric"`
	Value         float64   `json:"value"`
	ExpectedValue float64   `json:"expected_value"`
	Deviation     float64   `json:"deviation"`     // Standard deviations from mean
	Timestamp     time.Time `json:"timestamp"`
	RunID         string    `json:"run_id"`
	Severity      string    `json:"severity"`      // "info", "warning", "critical"
}

// MetricForecast represents a forecast of future metric values.
type MetricForecast struct {
	ReproducibilityTrend string    `json:"reproducibility_trend"`
	TrustTrend           string    `json:"trust_trend"`
	PredictedNextScore   float64   `json:"predicted_next_score"`
	ConfidenceInterval   [2]float64 `json:"confidence_interval"`
	ForecastHorizon      string    `json:"forecast_horizon"`
}

// ============================================================================
// TREND METRICS - Manager
// ============================================================================

// TrendMetricsManager manages trend metrics computation.
type TrendMetricsManager struct {
	db       *sql.DB
	mu       sync.RWMutex
	dataDir  string
	detector *DriftDetector
}

// NewTrendMetricsManager creates a new trend metrics manager.
func NewTrendMetricsManager(dataDir string, detector *DriftDetector) (*TrendMetricsManager, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "trend_metrics.db")
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	mgr := &TrendMetricsManager{db: db, dataDir: dataDir, detector: detector}
	if err := mgr.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return mgr, nil
}

// migrate creates the necessary tables.
func (m *TrendMetricsManager) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS metric_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pipeline_id TEXT NOT NULL,
			run_id TEXT NOT NULL,
			timestamp TIMESTAMP NOT NULL,
			metric_name TEXT NOT NULL,
			metric_value REAL NOT NULL,
			metadata_json TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_pipeline_metric ON metric_snapshots(pipeline_id, metric_name)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON metric_snapshots(timestamp)`,
		`CREATE TABLE IF NOT EXISTS step_stability (
			step_key TEXT PRIMARY KEY,
			stability_score REAL NOT NULL,
			occurrences INTEGER NOT NULL,
			last_seen TIMESTAMP,
			variance_sum REAL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS metric_anomalies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pipeline_id TEXT NOT NULL,
			run_id TEXT NOT NULL,
			timestamp TIMESTAMP NOT NULL,
			anomaly_type TEXT NOT NULL,
			metric_name TEXT NOT NULL,
			value REAL NOT NULL,
			expected_value REAL NOT NULL,
			deviation REAL NOT NULL,
			severity TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_anomalies_pipeline ON metric_anomalies(pipeline_id)`,
	}
	for _, q := range queries {
		if _, err := m.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection.
func (m *TrendMetricsManager) Close() error {
	return m.db.Close()
}

// ============================================================================
// METRICS RECORDING
// ============================================================================

// RecordMetricSnapshot records a metric snapshot.
func (m *TrendMetricsManager) RecordMetricSnapshot(ctx context.Context, pipelineID, runID, metricName string, value float64, metadata map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	metadataJSON, _ := json.Marshal(metadata)
	_, err := m.db.ExecContext(ctx, `
		INSERT INTO metric_snapshots (pipeline_id, run_id, timestamp, metric_name, metric_value, metadata_json)
		VALUES (?, ?, ?, ?, ?, ?)
	`, pipelineID, runID, time.Now().UTC(), metricName, value, string(metadataJSON))
	return err
}

// RecordStepStability records step stability data.
func (m *TrendMetricsManager) RecordStepStability(ctx context.Context, stepKey string, variance float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	_, err := m.db.ExecContext(ctx, `
		INSERT INTO step_stability (step_key, stability_score, occurrences, last_seen, variance_sum)
		VALUES (?, 1.0, 1, ?, ?)
		ON CONFLICT(step_key) DO UPDATE SET 
			occurrences = occurrences + 1,
			last_seen = excluded.last_seen,
			variance_sum = variance_sum + excluded.variance_sum,
			stability_score = 1.0 - (variance_sum + excluded.variance_sum) / (occurrences + 1)
	`, stepKey, time.Now().UTC(), variance)
	return err
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

// ComputeTrendMetrics computes comprehensive trend metrics for a pipeline.
func (m *TrendMetricsManager) ComputeTrendMetrics(ctx context.Context, pipelineID string, windowDays int) (*TrendMetricsReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if windowDays <= 0 {
		windowDays = 30
	}

	now := time.Now().UTC()
	start := now.AddDate(0, 0, -windowDays)
	window := TimeWindow{Start: start, End: now, Days: windowDays}

	report := &TrendMetricsReport{
		PipelineID:            pipelineID,
		GeneratedAt:           now,
		TimeWindow:            window,
		StepStabilityPercentile: make(map[string]float64),
	}

	// 1. Compute mean reproducibility
	report.MeanReproducibility = m.computeMeanMetric(ctx, pipelineID, "reproducibility_score", start, now)

	// 2. Compute trust volatility index
	report.TrustVolatilityIndex = m.computeVolatilityIndex(ctx, pipelineID, "trust_score", start, now)

	// 3. Compute metric history
	report.MetricHistory = m.computeMetricHistory(ctx, pipelineID, start, now)

	// 4. Compute step stability percentiles
	report.StepStabilityPercentile = m.computeStepStabilityPercentiles(ctx)

	// 5. Compute step rankings
	report.StepRankings = m.computeStepRankings(ctx)

	// 6. Detect anomalies
	report.Anomalies = m.detectAnomalies(ctx, pipelineID, start, now)

	// 7. Count runs analyzed
	report.RunsAnalyzed = len(report.MetricHistory.Reproducibility)

	// 8. Generate forecast
	report.Forecast = m.generateForecast(report)

	return report, nil
}

// computeMeanMetric computes the mean value of a metric.
func (m *TrendMetricsManager) computeMeanMetric(ctx context.Context, pipelineID, metricName string, start, end time.Time) float64 {
	var mean float64
	var count int
	err := m.db.QueryRowContext(ctx, `
		SELECT AVG(metric_value), COUNT(*)
		FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
	`, pipelineID, metricName, start, end).Scan(&mean, &count)
	if err != nil || count == 0 {
		return 0
	}
	return mean
}

// computeVolatilityIndex computes the volatility index for a metric.
func (m *TrendMetricsManager) computeVolatilityIndex(ctx context.Context, pipelineID, metricName string, start, end time.Time) float64 {
	// Get all values
	rows, err := m.db.QueryContext(ctx, `
		SELECT metric_value FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC
	`, pipelineID, metricName, start, end)
	if err != nil {
		return 0
	}
	defer rows.Close()

	var values []float64
	for rows.Next() {
		var v float64
		if err := rows.Scan(&v); err != nil {
			continue
		}
		values = append(values, v)
	}

	if len(values) < 2 {
		return 0
	}

	// Compute coefficient of variation (CV) as volatility index
	mean := meanValue(values)
	if mean == 0 {
		return 0
	}
	stdDev := math.Sqrt(varianceValue(values, mean))
	return stdDev / mean
}

// computeMetricHistory computes the full metric history.
func (m *TrendMetricsManager) computeMetricHistory(ctx context.Context, pipelineID string, start, end time.Time) MetricHistory {
	history := MetricHistory{}

	// Reproducibility
	rows, err := m.db.QueryContext(ctx, `
		SELECT timestamp, metric_value, run_id FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = 'reproducibility_score' AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC
	`, pipelineID, start, end)
	if err == nil {
		for rows.Next() {
			var dp DataPoint
			if err := rows.Scan(&dp.Timestamp, &dp.Value, &dp.RunID); err == nil {
				history.Reproducibility = append(history.Reproducibility, dp)
			}
		}
		rows.Close()
	}

	// Trust Score
	rows, err = m.db.QueryContext(ctx, `
		SELECT timestamp, metric_value, run_id FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = 'trust_score' AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC
	`, pipelineID, start, end)
	if err == nil {
		for rows.Next() {
			var dp DataPoint
			if err := rows.Scan(&dp.Timestamp, &dp.Value, &dp.RunID); err == nil {
				history.TrustScore = append(history.TrustScore, dp)
			}
		}
		rows.Close()
	}

	// Chaos Sensitivity
	rows, err = m.db.QueryContext(ctx, `
		SELECT timestamp, metric_value, run_id FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = 'chaos_sensitivity' AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC
	`, pipelineID, start, end)
	if err == nil {
		for rows.Next() {
			var dp DataPoint
			if err := rows.Scan(&dp.Timestamp, &dp.Value, &dp.RunID); err == nil {
				history.ChaosSensitivity = append(history.ChaosSensitivity, dp)
			}
		}
		rows.Close()
	}

	// Step Count
	rows, err = m.db.QueryContext(ctx, `
		SELECT timestamp, metric_value, run_id FROM metric_snapshots
		WHERE pipeline_id = ? AND metric_name = 'step_count' AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC
	`, pipelineID, start, end)
	if err == nil {
		for rows.Next() {
			var dp DataPoint
			if err := rows.Scan(&dp.Timestamp, &dp.Value, &dp.RunID); err == nil {
				history.StepCount = append(history.StepCount, dp)
			}
		}
		rows.Close()
	}

	return history
}

// computeStepStabilityPercentiles computes stability percentiles for all steps.
func (m *TrendMetricsManager) computeStepStabilityPercentiles(ctx context.Context) map[string]float64 {
	rows, err := m.db.QueryContext(ctx, `
		SELECT step_key, stability_score FROM step_stability
	`)
	if err != nil {
		return make(map[string]float64)
	}
	defer rows.Close()

	// Collect all scores
	scores := make(map[string]float64)
	var allScores []float64
	for rows.Next() {
		var stepKey string
		var score float64
		if err := rows.Scan(&stepKey, &score); err != nil {
			continue
		}
		scores[stepKey] = score
		allScores = append(allScores, score)
	}

	// Sort for percentile calculation
	sort.Float64s(allScores)

	// Compute percentile for each step
	percentiles := make(map[string]float64)
	for stepKey, score := range scores {
		// Find percentile
		count := 0
		for _, s := range allScores {
			if s <= score {
				count++
			}
		}
		percentiles[stepKey] = float64(count) / float64(len(allScores)) * 100
	}

	return percentiles
}

// computeStepRankings computes stability rankings for steps.
func (m *TrendMetricsManager) computeStepRankings(ctx context.Context) []StepRanking {
	rows, err := m.db.QueryContext(ctx, `
		SELECT step_key, stability_score, occurrences, last_seen, variance_sum
		FROM step_stability
		ORDER BY stability_score DESC
		LIMIT 100
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var rankings []StepRanking
	for rows.Next() {
		var r StepRanking
		var lastSeen sql.NullTime
		var varianceSum float64
		if err := rows.Scan(&r.StepKey, &r.StabilityScore, &r.Occurrences, &lastSeen, &varianceSum); err != nil {
			continue
		}
		if lastSeen.Valid {
			r.LastSeen = lastSeen.Time
		}
		r.VarianceFromNorm = varianceSum / float64(r.Occurrences)
		rankings = append(rankings, r)
	}

	// Compute percentiles
	for i := range rankings {
		rankings[i].Percentile = float64(len(rankings)-i) / float64(len(rankings)) * 100
	}

	return rankings
}

// detectAnomalies detects anomalies in metrics.
func (m *TrendMetricsManager) detectAnomalies(ctx context.Context, pipelineID string, start, end time.Time) []MetricAnomaly {
	var anomalies []MetricAnomaly

	// Get metric statistics
	metrics := []string{"reproducibility_score", "trust_score", "chaos_sensitivity"}
	for _, metric := range metrics {
		var mean, stdDev float64
		err := m.db.QueryRowContext(ctx, `
			SELECT AVG(metric_value), 
			       SQRT(SUM((metric_value - (SELECT AVG(m2.metric_value) FROM metric_snapshots m2 WHERE m2.pipeline_id = m1.pipeline_id AND m2.metric_name = m1.metric_name)) * 
			             (metric_value - (SELECT AVG(m2.metric_value) FROM metric_snapshots m2 WHERE m2.pipeline_id = m1.pipeline_id AND m2.metric_name = m1.metric_name))) / COUNT(*))
			FROM metric_snapshots m1
			WHERE pipeline_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
		`, pipelineID, metric, start, end).Scan(&mean, &stdDev)
		if err != nil || stdDev == 0 {
			continue
		}

		// Find values more than 2 standard deviations from mean
		rows, err := m.db.QueryContext(ctx, `
			SELECT timestamp, metric_value, run_id FROM metric_snapshots
			WHERE pipeline_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
			  AND ABS(metric_value - ?) > ? * 2
		`, pipelineID, metric, start, end, mean, stdDev)
		if err != nil {
			continue
		}
		for rows.Next() {
			var timestamp time.Time
			var value float64
			var runID string
			if err := rows.Scan(&timestamp, &value, &runID); err != nil {
				continue
			}

			deviation := math.Abs(value - mean) / stdDev
			severity := "info"
			if deviation > 3 {
				severity = "critical"
			} else if deviation > 2.5 {
				severity = "warning"
			}

			anomalyType := "spike"
			if value < mean {
				anomalyType = "drop"
			}

			anomalies = append(anomalies, MetricAnomaly{
				Type:          anomalyType,
				Metric:        metric,
				Value:         value,
				ExpectedValue: mean,
				Deviation:     deviation,
				Timestamp:     timestamp,
				RunID:         runID,
				Severity:      severity,
			})
		}
		rows.Close()
	}

	// Sort by timestamp descending
	sort.Slice(anomalies, func(i, j int) bool {
		return anomalies[i].Timestamp.After(anomalies[j].Timestamp)
	})

	return anomalies
}

// generateForecast generates a forecast based on historical trends.
func (m *TrendMetricsManager) generateForecast(report *TrendMetricsReport) *MetricForecast {
	if len(report.MetricHistory.Reproducibility) < 3 {
		return nil
	}

	forecast := &MetricForecast{
		ForecastHorizon: "7d",
	}

	// Compute trend for reproducibility
	slope, _ := linearRegression(report.MetricHistory.Reproducibility)
	if slope > 0.001 {
		forecast.ReproducibilityTrend = "improving"
	} else if slope < -0.001 {
		forecast.ReproducibilityTrend = "declining"
	} else {
		forecast.ReproducibilityTrend = "stable"
	}

	// Compute trend for trust
	slope, _ = linearRegression(report.MetricHistory.TrustScore)
	if slope > 0.001 {
		forecast.TrustTrend = "improving"
	} else if slope < -0.001 {
		forecast.TrustTrend = "declining"
	} else {
		forecast.TrustTrend = "stable"
	}

	// Predict next score
	lastValues := report.MetricHistory.Reproducibility
	if len(lastValues) > 0 {
		forecast.PredictedNextScore = lastValues[len(lastValues)-1].Value + slope*7 // 7 days ahead
		
		// Confidence interval (simplified)
		stdDev := math.Sqrt(varianceValue(
			mapToValues(lastValues), 
			meanValue(mapToValues(lastValues)),
		))
		forecast.ConfidenceInterval = [2]float64{
			forecast.PredictedNextScore - 1.96*stdDev,
			forecast.PredictedNextScore + 1.96*stdDev,
		}
	}

	return forecast
}

// ============================================================================
// REPORT OUTPUT
// ============================================================================

// WriteReportJSON writes the trend metrics report to a JSON file.
func (m *TrendMetricsManager) WriteReportJSON(report *TrendMetricsReport, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// WriteReportMarkdown writes the trend metrics report to a Markdown file.
func (m *TrendMetricsManager) WriteReportMarkdown(report *TrendMetricsReport, path string) error {
	var md strings.Builder

	md.WriteString(fmt.Sprintf("# Trend Metrics Report\n\n"))
	md.WriteString(fmt.Sprintf("**Pipeline:** %s\n\n", report.PipelineID))
	md.WriteString(fmt.Sprintf("**Time Window:** %s to %s (%d days)\n\n", 
		report.TimeWindow.Start.Format("2006-01-02"),
		report.TimeWindow.End.Format("2006-01-02"),
		report.TimeWindow.Days))
	md.WriteString(fmt.Sprintf("**Runs Analyzed:** %d\n\n", report.RunsAnalyzed))

	// Summary metrics
	md.WriteString("## Summary Metrics\n\n")
	md.WriteString(fmt.Sprintf("- **Mean Reproducibility:** %.4f\n", report.MeanReproducibility))
	md.WriteString(fmt.Sprintf("- **Trust Volatility Index:** %.4f\n", report.TrustVolatilityIndex))
	md.WriteString("\n")

	// Forecast
	if report.Forecast != nil {
		md.WriteString("## Forecast\n\n")
		md.WriteString(fmt.Sprintf("- **Reproducibility Trend:** %s\n", report.Forecast.ReproducibilityTrend))
		md.WriteString(fmt.Sprintf("- **Trust Trend:** %s\n", report.Forecast.TrustTrend))
		md.WriteString(fmt.Sprintf("- **Predicted Next Score:** %.4f\n", report.Forecast.PredictedNextScore))
		md.WriteString(fmt.Sprintf("- **95%% Confidence Interval:** [%.4f, %.4f]\n\n", 
			report.Forecast.ConfidenceInterval[0], report.Forecast.ConfidenceInterval[1]))
	}

	// Step Rankings
	if len(report.StepRankings) > 0 {
		md.WriteString("## Step Stability Rankings\n\n")
		md.WriteString("| Rank | Step Key | Stability | Percentile | Occurrences |\n")
		md.WriteString("|------|----------|-----------|------------|-------------|\n")
		for i, r := range report.StepRankings {
			if i >= 20 {
				break
			}
			md.WriteString(fmt.Sprintf("| %d | %s | %.2f | %.1f%% | %d |\n", 
				i+1, r.StepKey, r.StabilityScore, r.Percentile, r.Occurrences))
		}
		md.WriteString("\n")
	}

	// Anomalies
	if len(report.Anomalies) > 0 {
		md.WriteString("## Detected Anomalies\n\n")
		md.WriteString("| Timestamp | Metric | Type | Value | Expected | Deviation | Severity |\n")
		md.WriteString("|-----------|--------|------|-------|----------|-----------|----------|\n")
		for _, a := range report.Anomalies {
			md.WriteString(fmt.Sprintf("| %s | %s | %s | %.4f | %.4f | %.2fσ | %s |\n",
				a.Timestamp.Format("2006-01-02 15:04"), a.Metric, a.Type, a.Value, a.ExpectedValue, a.Deviation, a.Severity))
		}
		md.WriteString("\n")
	}

	return os.WriteFile(path, []byte(md.String()), 0o644)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func mapToValues(points []DataPoint) []float64 {
	values := make([]float64, len(points))
	for i, p := range points {
		values[i] = p.Value
	}
	return values
}
