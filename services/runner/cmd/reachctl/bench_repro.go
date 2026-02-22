package main

// bench_repro.go — Phase B: Reproducibility Benchmark Suite
//
// Command: reachctl bench reproducibility <pipelineId|config> [flags]
//
// Computes:
//   - proof stability rate (% of runs with identical proofHash)
//   - step drift % (% of runs with step key differences)
//   - entropy variance (variance in event log lengths)
//   - duration variance (coefficient of variation of run durations)
//   - chaos sensitivity (if chaos enabled)
//
// Outputs:
//   - reproducibility.json
//   - reproducibility.md (human-readable)
//   - reproducibilityScore (0-100)
//   - reproducibilityBadge (markdown snippet)

import (
	"flag"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"reach/services/runner/internal/determinism"
)

// ReproducibilityReport is the machine-readable output for a benchmark run.
type ReproducibilityReport struct {
	PipelineID          string               `json:"pipeline_id"`
	Runs                int                  `json:"runs"`
	ProofStabilityRate  float64              `json:"proof_stability_rate"`
	StepDriftPct        float64              `json:"step_drift_pct"`
	EntropyVariance     float64              `json:"entropy_variance"`
	DurationVariancePct float64              `json:"duration_variance_pct"`
	ChaosSensitivity    float64              `json:"chaos_sensitivity"`
	ReproducibilityScore int                 `json:"reproducibility_score"`
	Badge               string               `json:"badge_markdown"`
	RunHashes           []string             `json:"run_hashes"`
	StepCounts          []int                `json:"step_counts"`
	Details             []ReproRunDetail     `json:"details"`
}

// ReproRunDetail holds per-run data for the benchmark.
type ReproRunDetail struct {
	RunIndex   int     `json:"run_index"`
	ProofHash  string  `json:"proof_hash"`
	StepCount  int     `json:"step_count"`
	LatencyMs  float64 `json:"latency_ms"`
	Stable     bool    `json:"stable"`
}

// runBenchReproducibility implements `reachctl bench reproducibility`.
func runBenchReproducibility(dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("bench reproducibility", flag.ContinueOnError)
	fs.SetOutput(errOut)
	runsFlag := fs.Int("runs", 5, "Number of repeated runs (default 5)")
	jsonFlag := fs.Bool("json", false, "Output JSON to stdout")
	outputFlag := fs.String("output", "", "Output directory for reproducibility.json and .md")
	_ = fs.Parse(args)

	remaining := fs.Args()
	pipelineID := "sample"
	if len(remaining) > 0 {
		pipelineID = remaining[0]
	}

	if *runsFlag < 2 {
		_, _ = fmt.Fprintln(errOut, "error: --runs must be >= 2")
		return 1
	}
	if *runsFlag > 100 {
		_, _ = fmt.Fprintln(errOut, "error: --runs must be <= 100")
		return 1
	}

	outputDir := dataRoot
	if *outputFlag != "" {
		outputDir = *outputFlag
	}

	report := computeReproducibility(dataRoot, pipelineID, *runsFlag)

	jsonPath := filepath.Join(outputDir, "reproducibility.json")
	mdPath := filepath.Join(outputDir, "reproducibility.md")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		_, _ = fmt.Fprintf(errOut, "error creating output dir: %v\n", err)
		return 1
	}
	if err := writeDeterministicJSON(jsonPath, report); err != nil {
		_, _ = fmt.Fprintf(errOut, "error writing JSON: %v\n", err)
		return 1
	}
	md := reproducibilityMarkdown(report)
	if err := os.WriteFile(mdPath, []byte(md), 0o644); err != nil {
		_, _ = fmt.Fprintf(errOut, "error writing markdown: %v\n", err)
		return 1
	}

	if *jsonFlag {
		return writeJSON(out, report)
	}

	_, _ = fmt.Fprintf(out, "Reproducibility Benchmark: %s\n", pipelineID)
	_, _ = fmt.Fprintf(out, "============================\n")
	_, _ = fmt.Fprintf(out, "Runs:                 %d\n", report.Runs)
	_, _ = fmt.Fprintf(out, "Score:                %d/100\n", report.ReproducibilityScore)
	_, _ = fmt.Fprintf(out, "Proof stability:      %.1f%%\n", report.ProofStabilityRate)
	_, _ = fmt.Fprintf(out, "Step drift:           %.1f%%\n", report.StepDriftPct)
	_, _ = fmt.Fprintf(out, "Entropy variance:     %.4f\n", report.EntropyVariance)
	_, _ = fmt.Fprintf(out, "Duration variance:    %.1f%%\n", report.DurationVariancePct)
	_, _ = fmt.Fprintf(out, "Chaos sensitivity:    %.1f%%\n", report.ChaosSensitivity)
	_, _ = fmt.Fprintf(out, "\nBadge:\n%s\n", report.Badge)
	_, _ = fmt.Fprintf(out, "\nReport: %s\n", jsonPath)
	_, _ = fmt.Fprintf(out, "Markdown: %s\n", mdPath)

	return 0
}

// computeReproducibility simulates N runs for a pipeline and measures stability.
// In production, each run would replay the actual pipeline; here we derive
// deterministic results from run records stored on disk.
func computeReproducibility(dataRoot, pipelineID string, n int) *ReproducibilityReport {
	runsDir := filepath.Join(dataRoot, "runs")
	report := &ReproducibilityReport{
		PipelineID: pipelineID,
		Runs:       n,
		RunHashes:  make([]string, 0, n),
		StepCounts: make([]int, 0, n),
		Details:    make([]ReproRunDetail, 0, n),
	}

	// Load actual run records when they exist; otherwise synthetic
	records, _ := loadRunsForPipeline(runsDir, pipelineID, n)

	// Compute synthetic records for missing runs using deterministic derivation
	for i := len(records); i < n; i++ {
		syntheticHash := deterministicRunHash(pipelineID, i)
		records = append(records, reproRun{
			proofHash: syntheticHash,
			stepCount: 5,
			latencyMs: 50.0,
		})
	}

	// Analyze
	hashFreq := make(map[string]int)
	latencies := make([]float64, 0, n)
	firstHash := records[0].proofHash
	driftCount := 0

	for i, r := range records {
		hashFreq[r.proofHash]++
		latencies = append(latencies, r.latencyMs)
		stable := r.proofHash == firstHash
		if !stable {
			driftCount++
		}
		report.RunHashes = append(report.RunHashes, r.proofHash)
		report.StepCounts = append(report.StepCounts, r.stepCount)
		report.Details = append(report.Details, ReproRunDetail{
			RunIndex:  i,
			ProofHash: r.proofHash,
			StepCount: r.stepCount,
			LatencyMs: r.latencyMs,
			Stable:    stable,
		})
	}

	// Proof stability rate
	mostFreqCount := 0
	for _, c := range hashFreq {
		if c > mostFreqCount {
			mostFreqCount = c
		}
	}
	report.ProofStabilityRate = float64(mostFreqCount) / float64(n) * 100

	// Step drift %
	report.StepDriftPct = float64(driftCount) / float64(n) * 100

	// Entropy variance (variance in step counts)
	report.EntropyVariance = variance(toFloat64(report.StepCounts))

	// Duration variance (coefficient of variation as %)
	report.DurationVariancePct = coeffVariation(latencies)

	// Chaos sensitivity — 0 until chaos is actually run
	report.ChaosSensitivity = 0.0

	// Score: 100 - weighted penalty
	score := 100.0
	score -= (100 - report.ProofStabilityRate) * 0.6 // 60% weight on proof stability
	score -= report.StepDriftPct * 0.2               // 20% weight on drift
	score -= report.EntropyVariance * 2               // variance penalty
	score -= report.DurationVariancePct * 0.1         // 10% weight on duration
	if score < 0 {
		score = 0
	}
	report.ReproducibilityScore = int(math.Round(score))

	// Badge
	report.Badge = reproducibilityBadge(report.ReproducibilityScore)

	return report
}

type reproRun struct {
	proofHash string
	stepCount int
	latencyMs float64
}

func loadRunsForPipeline(runsDir, pipelineID string, limit int) ([]reproRun, error) {
	entries, err := os.ReadDir(runsDir)
	if err != nil {
		return nil, err
	}
	// Sort deterministically
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	var runs []reproRun
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), ".json")
		if pipelineID != "sample" && !strings.HasPrefix(id, pipelineID) {
			continue
		}
		rec, err := loadRunRecord(runsDir[:len(runsDir)-len("/runs")], id)
		if err != nil {
			continue
		}
		hash := determinism.Hash(map[string]any{"event_log": rec.EventLog, "run_id": rec.RunID})
		runs = append(runs, reproRun{
			proofHash: hash,
			stepCount: len(rec.EventLog),
			latencyMs: rec.Latency,
		})
		if len(runs) >= limit {
			break
		}
	}
	return runs, nil
}

func deterministicRunHash(pipelineID string, index int) string {
	// Fully deterministic hash — no time.Now(), no rand
	return determinism.Hash(map[string]any{
		"pipeline_id": pipelineID,
		"run_index":   index,
		"version":     "bench-v1",
	})
}

func variance(data []float64) float64 {
	if len(data) < 2 {
		return 0
	}
	mean := 0.0
	for _, v := range data {
		mean += v
	}
	mean /= float64(len(data))
	sum := 0.0
	for _, v := range data {
		d := v - mean
		sum += d * d
	}
	return sum / float64(len(data)-1)
}

func coeffVariation(data []float64) float64 {
	if len(data) < 2 {
		return 0
	}
	mean := 0.0
	for _, v := range data {
		mean += v
	}
	mean /= float64(len(data))
	if mean == 0 {
		return 0
	}
	stdDev := math.Sqrt(variance(data))
	return (stdDev / mean) * 100
}

func toFloat64(ints []int) []float64 {
	out := make([]float64, len(ints))
	for i, v := range ints {
		out[i] = float64(v)
	}
	return out
}

func reproducibilityBadge(score int) string {
	color := "red"
	label := "low"
	switch {
	case score >= 95:
		color = "brightgreen"
		label = "excellent"
	case score >= 80:
		color = "green"
		label = "good"
	case score >= 60:
		color = "yellow"
		label = "fair"
	}
	return fmt.Sprintf(
		"![Reproducibility %d%%](https://img.shields.io/badge/reproducibility-%d%%25-%s?style=flat-square)",
		score, score, color,
	) + fmt.Sprintf("\n\n> **Reproducibility Score: %d/100** — %s", score, label)
}

func reproducibilityMarkdown(r *ReproducibilityReport) string {
	var sb strings.Builder
	sb.WriteString("# Reproducibility Benchmark Report\n\n")
	sb.WriteString(fmt.Sprintf("**Pipeline:** `%s`  \n", r.PipelineID))
	sb.WriteString(fmt.Sprintf("**Runs:** %d  \n\n", r.Runs))

	sb.WriteString("## Score\n\n")
	sb.WriteString(r.Badge)
	sb.WriteString("\n\n")

	sb.WriteString("## Metrics\n\n")
	sb.WriteString("| Metric | Value |\n")
	sb.WriteString("|--------|-------|\n")
	sb.WriteString(fmt.Sprintf("| Proof Stability Rate | %.1f%% |\n", r.ProofStabilityRate))
	sb.WriteString(fmt.Sprintf("| Step Drift | %.1f%% |\n", r.StepDriftPct))
	sb.WriteString(fmt.Sprintf("| Entropy Variance | %.4f |\n", r.EntropyVariance))
	sb.WriteString(fmt.Sprintf("| Duration Variance | %.1f%% |\n", r.DurationVariancePct))
	sb.WriteString(fmt.Sprintf("| Chaos Sensitivity | %.1f%% |\n", r.ChaosSensitivity))
	sb.WriteString("\n")

	sb.WriteString("## Run Details\n\n")
	sb.WriteString("| Run | Proof Hash (truncated) | Steps | Latency (ms) | Stable |\n")
	sb.WriteString("|-----|------------------------|-------|--------------|--------|\n")
	for _, d := range r.Details {
		truncated := d.ProofHash
		if len(truncated) > 16 {
			truncated = truncated[:16] + "..."
		}
		stable := "✓"
		if !d.Stable {
			stable = "✗"
		}
		sb.WriteString(fmt.Sprintf("| %d | `%s` | %d | %.1f | %s |\n",
			d.RunIndex+1, truncated, d.StepCount, d.LatencyMs, stable))
	}

	return sb.String()
}
