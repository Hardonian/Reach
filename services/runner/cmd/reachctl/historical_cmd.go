// Package main provides CLI commands for historical intelligence features.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"reach/services/runner/internal/historical"
)

// Usage: historical <command> [options]
func runHistorical(ctx context.Context, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usageHistorical(out)
		return 1
	}

	dataRoot := getHistoricalDataRoot()

	switch args[0] {
	case "search":
		return runSearch(ctx, dataRoot, args[1:], out, errOut)
	case "drift":
		return runDrift(ctx, dataRoot, args[1:], out, errOut)
	case "baseline":
		return runBaseline(ctx, dataRoot, args[1:], out, errOut)
	case "metrics":
		return runMetrics(ctx, dataRoot, args[1:], out, errOut)
	case "diff":
		return runDiff(ctx, dataRoot, args[1:], out, errOut)
	case "seed":
		return runSeed(ctx, dataRoot, args[1:], out, errOut)
	default:
		_, _ = fmt.Fprintln(errOut, "unknown historical command")
		usageHistorical(out)
		return 1
	}
}

func getHistoricalDataRoot() string {
	// Try to use existing data directory
	if dataDir := os.Getenv("REACH_DATA_DIR"); dataDir != "" {
		return filepath.Join(dataDir, "historical")
	}
	return filepath.Join("data", "historical")
}

// ============================================================================
// SEARCH COMMAND
// ============================================================================

// runSearch handles the search command for lineage index lookups.
func runSearch(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("search", flag.ContinueOnError)
	fs.SetOutput(errOut)

	byHash := fs.String("by-hash", "", "Search by artifact hash")
	byStep := fs.String("by-step", "", "Search by step key")
	byPlugin := fs.String("by-plugin", "", "Search by plugin name")
	similar := fs.String("similar", "", "Find runs similar to given run ID")
	limit := fs.Int("limit", 10, "Maximum results to return")
	_ = fs.Parse(args)

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	index := mgr.Index()

	var results interface{}

	switch {
	case *byHash != "":
		searchResults, err := index.SearchByHash(ctx, *byHash)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "Search failed: %v\n", err)
			return 1
		}
		results = searchResults

	case *byStep != "":
		searchResults, err := index.SearchByStep(ctx, *byStep, *limit)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "Search failed: %v\n", err)
			return 1
		}
		results = searchResults

	case *byPlugin != "":
		searchResults, err := index.SearchByPlugin(ctx, *byPlugin, *limit)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "Search failed: %v\n", err)
			return 1
		}
		results = searchResults

	case *similar != "":
		similarRuns, err := index.SearchSimilar(ctx, *similar, *limit)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "Similarity search failed: %v\n", err)
			return 1
		}
		results = similarRuns

	default:
		_, _ = fmt.Fprintln(errOut, "Must specify one of: --by-hash, --by-step, --by-plugin, --similar")
		return 1
	}

	return writeJSON(out, map[string]interface{}{
		"command": "search",
		"results": results,
		"count":   getResultCount(results),
	})
}

func getResultCount(results interface{}) int {
	switch r := results.(type) {
	case []historical.SearchResult:
		return len(r)
	case []historical.SimilarRun:
		return len(r)
	default:
		return 0
	}
}

// ============================================================================
// DRIFT COMMAND
// ============================================================================

// runDrift handles the drift analyze command.
func runDrift(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("drift", flag.ContinueOnError)
	fs.SetOutput(errOut)

	pipelineID := fs.String("pipeline-id", "", "Pipeline ID to analyze (required)")
	window := fs.Int("window", 30, "Analysis window in days")
	outputJSON := fs.String("output-json", "", "Output JSON file path")
	outputMD := fs.String("output-md", "", "Output Markdown file path")
	_ = fs.Parse(args)

	if *pipelineID == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --pipeline-id is required")
		return 1
	}

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	drift := mgr.Drift()
	report, err := drift.AnalyzeDrift(ctx, *pipelineID, *window)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Drift analysis failed: %v\n", err)
		return 1
	}

	// Write output files if requested
	if *outputJSON != "" {
		if err := drift.WriteReportJSON(report, *outputJSON); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write JSON: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Drift report written to %s\n", *outputJSON)
	}

	if *outputMD != "" {
		if err := drift.WriteReportMarkdown(report, *outputMD); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write Markdown: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Drift report written to %s\n", *outputMD)
	}

	return writeJSON(out, map[string]interface{}{
		"command":     "drift",
		"pipeline_id": *pipelineID,
		"window_days": *window,
		"report":      report,
	})
}

// ============================================================================
// BASELINE COMMAND
// ============================================================================

// runBaseline handles baseline freeze and compare commands.
func runBaseline(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "Usage: historical baseline <freeze|compare|list> [options]")
		return 1
	}

	subCmd := args[0]
	remainingArgs := args[1:]

	switch subCmd {
	case "freeze":
		return runBaselineFreeze(ctx, dataRoot, remainingArgs, out, errOut)
	case "compare":
		return runBaselineCompare(ctx, dataRoot, remainingArgs, out, errOut)
	case "list":
		return runBaselineList(ctx, dataRoot, remainingArgs, out, errOut)
	default:
		_, _ = fmt.Fprintf(errOut, "Unknown baseline subcommand: %s\n", subCmd)
		return 1
	}
}

func runBaselineFreeze(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("baseline freeze", flag.ContinueOnError)
	fs.SetOutput(errOut)

	pipelineID := fs.String("pipeline-id", "", "Pipeline ID (required)")
	runID := fs.String("run-id", "", "Run ID to freeze (required)")
	frozenBy := fs.String("frozen-by", "system", "User who triggered the freeze")
	_ = fs.Parse(args)

	if *pipelineID == "" || *runID == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --pipeline-id and --run-id are required")
		return 1
	}

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	// Generate sample events (in practice would load from storage)
	events := generateSampleEvents(*runID)

	baseline, err := mgr.Baseline().FreezeBaseline(ctx, *pipelineID, *runID, events, *frozenBy)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to freeze baseline: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]interface{}{
		"command":     "baseline freeze",
		"baseline_id": baseline.ID,
		"pipeline_id": *pipelineID,
		"run_id":      *runID,
		"frozen_at":   baseline.FrozenAt.Format(time.RFC3339),
		"immutable":   baseline.Immutable,
	})
}

func runBaselineCompare(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("baseline compare", flag.ContinueOnError)
	fs.SetOutput(errOut)

	baselineID := fs.String("baseline-id", "", "Baseline ID to compare against")
	pipelineID := fs.String("pipeline-id", "", "Pipeline ID (alternative to --baseline-id)")
	runID := fs.String("run-id", "", "Run ID to compare (required)")
	_ = fs.Parse(args)

	if *runID == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --run-id is required")
		return 1
	}

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	// Get baseline ID
	blID := *baselineID
	if blID == "" && *pipelineID != "" {
		baseline, err := mgr.Baseline().GetBaselineByPipeline(ctx, *pipelineID)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "No baseline found for pipeline: %v\n", err)
			return 1
		}
		blID = baseline.ID
	}

	if blID == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --baseline-id or --pipeline-id required")
		return 1
	}

	// Generate sample events
	events := generateSampleEvents(*runID)

	comparison, err := mgr.Baseline().CompareToBaseline(ctx, blID, *runID, events)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to compare: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]interface{}{
		"command":    "baseline compare",
		"comparison": comparison,
	})
}

func runBaselineList(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("baseline list", flag.ContinueOnError)
	fs.SetOutput(errOut)

	limit := fs.Int("limit", 20, "Maximum number of baselines to list")
	_ = fs.Parse(args)

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	baselines, err := mgr.Baseline().ListBaselines(ctx, *limit)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to list baselines: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]interface{}{
		"command":   "baseline list",
		"baselines": baselines,
		"count":     len(baselines),
	})
}

// ============================================================================
// METRICS COMMAND
// ============================================================================

// runMetrics handles the metrics history command.
// If --daemon flag is provided, it fetches live metrics from the running daemon.
func runMetrics(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("metrics", flag.ContinueOnError)
	fs.SetOutput(errOut)

	daemonMode := fs.Bool("daemon", false, "Fetch live metrics from the running daemon")
	jsonOutput := fs.Bool("json", false, "Output in JSON format")
	serverURL := fs.String("server", "http://localhost:8080", "Server URL for daemon mode")
	pipelineID := fs.String("pipeline-id", "", "Pipeline ID to analyze (required for historical mode)")
	window := fs.Int("window", 30, "Analysis window in days (historical mode)")
	outputJSON := fs.String("output-json", "", "Output JSON file path")
	outputMD := fs.String("output-md", "", "Output Markdown file path")
	_ = fs.Parse(args)

	// If --daemon flag is provided, fetch live daemon metrics
	if *daemonMode {
		return runDaemonMetrics(*serverURL, *jsonOutput, out, errOut)
	}

	// Default behavior: if no pipeline-id, show daemon metrics help
	if *pipelineID == "" {
		// Try to fetch daemon metrics by default when no pipeline-id is provided
		serverURL := getenv("REACH_SERVER_URL", "http://localhost:8080")
		return runDaemonMetrics(serverURL, *jsonOutput, out, errOut)
	}

	// Historical metrics mode
	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	report, err := mgr.Trends().ComputeTrendMetrics(ctx, *pipelineID, *window)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to compute metrics: %v\n", err)
		return 1
	}

	// Write output files if requested
	if *outputJSON != "" {
		if err := mgr.Trends().WriteReportJSON(report, *outputJSON); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write JSON: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Metrics report written to %s\n", *outputJSON)
	}

	if *outputMD != "" {
		if err := mgr.Trends().WriteReportMarkdown(report, *outputMD); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write Markdown: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Metrics report written to %s\n", *outputMD)
	}

	return writeJSON(out, map[string]interface{}{
		"command":     "metrics",
		"pipeline_id": *pipelineID,
		"window_days": *window,
		"report":      report,
	})
}

// DaemonMetricsResponse represents the JSON metrics response from the daemon
type DaemonMetricsResponse struct {
	TotalExecutions uint64 `json:"total_executions"`
	AvgExecTime     uint64 `json:"avg_exec_time"`
	Latencies       *struct {
		P50 uint64 `json:"p50"`
		P95 uint64 `json:"p95"`
		P99 uint64 `json:"p99"`
	} `json:"latencies"`
	CASHitRate     uint64 `json:"cas_hit_rate_ppm"`
	QueueDepth     int32  `json:"queue_depth"`
	DaemonRestarts uint64 `json:"daemon_restarts"`
	MemoryUsage    uint64 `json:"memory_usage_bytes"`
	UptimeSeconds  float64 `json:"uptime_seconds"`
}

// runDaemonMetrics fetches and displays live metrics from the daemon
func runDaemonMetrics(serverURL string, jsonOutput bool, out io.Writer, errOut io.Writer) int {
	url := serverURL + "/v1/metrics?format=json"

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		if jsonOutput {
			emptyMetrics := DaemonMetricsResponse{}
			data, _ := json.Marshal(emptyMetrics)
			_, _ = fmt.Fprintln(out, string(data))
		} else {
			fmt.Fprintln(errOut, "Warning: Could not connect to daemon. Daemon may not be running.")
			fmt.Fprintln(out, "Reach Metrics (Daemon not running or unreachable)")
			fmt.Fprintln(out, "=============================================")
			fmt.Fprintf(out, "Server: %s\n", serverURL)
			fmt.Fprintln(out, "Status: Daemon not reachable")
			fmt.Fprintln(out)
			fmt.Fprintln(out, "To view daemon metrics, ensure the daemon is running:")
			fmt.Fprintln(out, "  reach serve")
		}
		return 1
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if jsonOutput {
			emptyMetrics := DaemonMetricsResponse{}
			data, _ := json.Marshal(emptyMetrics)
			_, _ = fmt.Fprintln(out, string(data))
		} else {
			fmt.Fprintf(errOut, "Error: Server returned status %d\n", resp.StatusCode)
		}
		return 1
	}

	var metrics DaemonMetricsResponse
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		if jsonOutput {
			emptyMetrics := DaemonMetricsResponse{}
			data, _ := json.Marshal(emptyMetrics)
			_, _ = fmt.Fprintln(out, string(data))
		} else {
			fmt.Fprintf(errOut, "Error: Failed to parse metrics response: %v\n", err)
		}
		return 1
	}

	if jsonOutput {
		data, err := json.Marshal(metrics)
		if err != nil {
			emptyMetrics := DaemonMetricsResponse{}
			data, _ := json.Marshal(emptyMetrics)
			_, _ = fmt.Fprintln(out, string(data))
			return 1
		}
		_, _ = fmt.Fprintln(out, string(data))
	} else {
		printDaemonMetricsHuman(metrics, out)
	}

	return 0
}

// printDaemonMetricsHuman prints daemon metrics in human-readable format
func printDaemonMetricsHuman(m DaemonMetricsResponse, out io.Writer) {
	fmt.Fprintln(out, "Reach Metrics")
	fmt.Fprintln(out, "=============")
	fmt.Fprintf(out, "Total Executions:   %d\n", m.TotalExecutions)
	fmt.Fprintf(out, "Avg Exec Time:      %d μs\n", m.AvgExecTime)
	if m.Latencies != nil {
		fmt.Fprintf(out, "Latency P50:       %d μs\n", m.Latencies.P50)
		fmt.Fprintf(out, "Latency P95:       %d μs\n", m.Latencies.P95)
		fmt.Fprintf(out, "Latency P99:       %d μs\n", m.Latencies.P99)
	}
	fmt.Fprintf(out, "CAS Hit Rate:      %d PPM\n", m.CASHitRate)
	fmt.Fprintf(out, "Queue Depth:       %d\n", m.QueueDepth)
	fmt.Fprintf(out, "Daemon Restarts:   %d\n", m.DaemonRestarts)
	fmt.Fprintf(out, "Memory Usage:      %d bytes (%.2f MB)\n", m.MemoryUsage, float64(m.MemoryUsage)/(1024*1024))
	fmt.Fprintf(out, "Uptime:            %.2f seconds\n", m.UptimeSeconds)
}

// GetDaemonMetricsStatus returns the daemon metrics status for doctor command
func GetDaemonMetricsStatus() string {
	serverURL := getenv("REACH_SERVER_URL", "http://localhost:8080")
	url := serverURL + "/v1/metrics?format=json"

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return fmt.Sprintf("UNAVAILABLE (%v)", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("UNAVAILABLE (status %d)", resp.StatusCode)
	}

	var metrics DaemonMetricsResponse
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return fmt.Sprintf("UNAVAILABLE (%v)", err)
	}

	if metrics.TotalExecutions > 0 {
		return fmt.Sprintf("OK (executions: %d, queue: %d)", metrics.TotalExecutions, metrics.QueueDepth)
	}
	return "OK (connected)"

// ============================================================================
// DIFF COMMAND
// ============================================================================

// runDiff handles the evidence diff command.
func runDiff(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("diff", flag.ContinueOnError)
	fs.SetOutput(errOut)

	referenceRunID := fs.String("reference", "", "Reference run ID")
	comparisonRunID := fs.String("comparison", "", "Comparison run ID")
	outputJSON := fs.String("output-json", "", "Output JSON file path")
	outputMD := fs.String("output-md", "", "Output Markdown file path")
	_ = fs.Parse(args)

	if *referenceRunID == "" || *comparisonRunID == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --reference and --comparison are required")
		return 1
	}

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	// Generate sample events
	refEvents := generateSampleEvents(*referenceRunID)
	compEvents := generateSampleEvents(*comparisonRunID)

	diff, err := mgr.Diff().ComputeEvidenceDiff(ctx, *referenceRunID, *comparisonRunID, refEvents, compEvents)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to compute diff: %v\n", err)
		return 1
	}

	// Write output files if requested
	if *outputJSON != "" {
		if err := mgr.Diff().WriteDiffJSON(diff, *outputJSON); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write JSON: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Diff report written to %s\n", *outputJSON)
	}

	if *outputMD != "" {
		if err := mgr.Diff().WriteDiffMarkdown(diff, *outputMD); err != nil {
			_, _ = fmt.Fprintf(errOut, "Failed to write Markdown: %v\n", err)
			return 1
		}
		_, _ = fmt.Fprintf(out, "Diff report written to %s\n", *outputMD)
	}

	return writeJSON(out, map[string]interface{}{
		"command":           "diff",
		"reference_run_id":  *referenceRunID,
		"comparison_run_id": *comparisonRunID,
		"diff":              diff,
	})
}

// ============================================================================
// SEED COMMAND
// ============================================================================

// runSeed seeds historical data for testing and demonstration.
func runSeed(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("seed", flag.ContinueOnError)
	fs.SetOutput(errOut)

	pipelineID := fs.String("pipeline-id", "default-pipeline", "Pipeline ID to seed")
	numRuns := fs.Int("runs", 10, "Number of runs to generate")
	_ = fs.Parse(args)

	mgr, err := historical.NewManager(historical.Config{DataDir: dataRoot})
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to create historical manager: %v\n", err)
		return 1
	}
	defer mgr.Close()

	err = mgr.SeedHistoricalData(ctx, *pipelineID, *numRuns)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Failed to seed data: %v\n", err)
		return 1
	}

	_, _ = fmt.Fprintf(out, "Seeded %d historical runs for pipeline %s\n", *numRuns, *pipelineID)

	return writeJSON(out, map[string]interface{}{
		"command":     "seed",
		"pipeline_id": *pipelineID,
		"runs":        *numRuns,
		"status":      "success",
	})
}

// ============================================================================
// HELPERS
// ============================================================================

func generateSampleEvents(runID string) []map[string]interface{} {
	tools := []string{"bash", "node", "python", "file_read", "http_get"}
	events := []map[string]interface{}{}

	for i, tool := range tools {
		events = append(events, map[string]interface{}{
			"type":          "tool.call",
			"tool":          tool,
			"run_id":        runID,
			"step_index":    i,
			"timestamp":     time.Now().Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			"artifact_hash": fmt.Sprintf("%x", []byte(runID+string(rune('0'+i))))[:16],
		})
	}

	return events
}

func usageHistorical(out io.Writer) {
	_, _ = io.WriteString(out, `usage: reachctl historical <command> [options]

Commands:
  search              Search lineage index
  drift               Analyze drift for a pipeline
  baseline            Manage frozen baselines
  metrics             Compute trend metrics
  diff                Compute evidence diff
  seed                Seed historical data

Search Options:
  --by-hash <hash>           Search by artifact hash
  --by-step <step-key>      Search by step key
  --by-plugin <plugin>      Search by plugin name
  --similar <run-id>        Find similar runs
  --limit <n>               Maximum results (default: 10)

Drift Options:
  --pipeline-id <id>        Pipeline ID to analyze (required)
  --window <days>           Analysis window in days (default: 30)
  --output-json <path>      Output JSON file
  --output-md <path>        Output Markdown file

Baseline Options:
  freeze                    Freeze a baseline
    --pipeline-id <id>      Pipeline ID (required)
    --run-id <id>           Run ID to freeze (required)
    --frozen-by <user>      User who triggered freeze (default: system)
  
  compare                   Compare run to baseline
    --baseline-id <id>      Baseline ID
    --pipeline-id <id>      Pipeline ID (uses latest baseline)
    --run-id <id>           Run ID to compare (required)
  
  list                      List frozen baselines
    --limit <n>             Maximum results (default: 20)

Metrics Options:
  --pipeline-id <id>        Pipeline ID to analyze (required)
  --window <days>          Analysis window in days (default: 30)
  --output-json <path>     Output JSON file
  --output-md <path>       Output Markdown file

Diff Options:
  --reference <run-id>     Reference run ID
  --comparison <run-id>    Comparison run ID
  --output-json <path>     Output JSON file
  --output-md <path>       Output Markdown file

Seed Options:
  --pipeline-id <id>       Pipeline ID (default: default-pipeline)
  --runs <n>              Number of runs to generate (default: 10)

Examples:
  # Search for runs by artifact hash
  reachctl historical search --by-hash abc123
  
  # Search for runs by step key
  reachctl historical search --by-step "tool:bash"
  
  # Find similar runs
  reachctl historical search --similar run-001 --limit 5
  
  # Analyze drift
  reachctl historical drift --pipeline-id my-pipeline --window 30d --output-md drift-report.md
  
  # Freeze a baseline
  reachctl historical baseline freeze --pipeline-id my-pipeline --run-id run-001
  
  # Compare to baseline
  reachctl historical baseline compare --pipeline-id my-pipeline --run-id run-002
  
  # Compute trend metrics
  reachctl historical metrics --pipeline-id my-pipeline --output-json metrics.json
  
  # Compute evidence diff
  reachctl historical diff --reference run-001 --comparison run-002 --output-md diff.md
  
  # Seed test data
  reachctl historical seed --pipeline-id test-pipeline --runs 10
`)
}
