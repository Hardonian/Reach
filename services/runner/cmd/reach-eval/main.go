package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"reach/core/evaluation"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/mcpserver"
	"reach/services/runner/internal/pack"
)

func main() {
	if len(os.Args) < 2 {
		printHelp()
		return
	}

	cmd := os.Args[1]
	switch cmd {
	case "run":
		runEval()
	case "compare":
		compareEval()
	case "suggest-rag":
		suggestRAG()
	case "help":
		printHelp()
	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printHelp()
		os.Exit(1)
	}
}

func printHelp() {
	fmt.Println("Reach Evaluation Tool")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  reach eval run [--all | --suite <name>]")
	fmt.Println("  reach eval compare --baseline <main>")
	fmt.Println("  reach eval suggest-rag")
}

func runEval() {
	runCmd := flag.NewFlagSet("run", flag.ExitOnError)
	all := runCmd.Bool("all", false, "Run all tests")
	suite := runCmd.String("suite", "", "Run specific suite")
	runCmd.Parse(os.Args[2:])

	dataRoot := os.Getenv("REACH_DATA_DIR")
	if dataRoot == "" {
		dataRoot = "data"
	}

	fmt.Printf("🚀 Starting Reach Evaluation (all: %v, suite: %s)...\n", *all, *suite)

	// 1. Setup execution environment
	registry := pack.NewPackRegistry()
	demoPath := filepath.Join(dataRoot, "packs", "arcadeSafe.demo.json")
	lintRes, err := pack.Lint(demoPath)
	if err != nil || lintRes == nil || !lintRes.Valid {
		fmt.Printf("⚠️ Warning: Failed to load demo pack at %s: %v\n", demoPath, err)
	}

	cid := registry.Register(lintRes)
	fmt.Printf("📦 Registered pack: %s (CID: %s)\n", lintRes.Metadata.Name, cid)

	mcpSrv := mcpserver.NewMockServer("../../")
	client := &mcpserver.LocalMCPClient{Server: mcpSrv}
	executor := jobs.NewDAGExecutor(registry, client)
	eval := evaluation.NewEvaluator()
	ctx := context.Background()

	// 2. Load Tests
	testDir := filepath.Join(dataRoot, "evaluation", "tests")
	_ = os.MkdirAll(testDir, 0755)

	// If no tests exist, create a sample for the demo
	sampleTestPath := filepath.Join(testDir, "smoke.json")
	if _, err := os.Stat(sampleTestPath); os.IsNotExist(err) {
		sample := evaluation.TestDefinition{
			ID:               "smoke-1",
			Input:            "Summarize the VERSION file.",
			ToolExpectations: []string{"read_file", "summarize"},
		}
		b, _ := json.MarshalIndent(sample, "", "  ")
		_ = os.WriteFile(sampleTestPath, b, 0644)
	}

	files, _ := filepath.Glob(filepath.Join(testDir, "*.json"))
	var totalScore float64
	var count int

	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		var test evaluation.TestDefinition
		if err := json.Unmarshal(b, &test); err != nil {
			continue
		}

		fmt.Printf("Running Test: %s [%s]\n", test.ID, test.Input)

		runID := fmt.Sprintf("eval-%s-%d", test.ID, time.Now().Unix())
		// Map test to the registered pack
		inputs := map[string]any{"mode": "safe"}

		results, state, err := executor.ExecuteGraph(ctx, cid, inputs)
		if err != nil {
			fmt.Printf("  ❌ Run failed: %v\n", err)
			continue
		}

		// Score
		finalResultJSON, _ := json.Marshal(results["node2"])
		res, err := eval.ScoreRun(ctx, &test, runID, string(finalResultJSON), nil, time.Duration(state.Latency)*time.Millisecond, state.TokenUsage)
		if err != nil {
			fmt.Printf("  ❌ Scoring failed: %v\n", err)
			continue
		}

		fmt.Printf("  ✅ Score: %.2f (Latency: %.0fms, Tokens: %d)\n", res.Score, res.Latency, res.TokenUsage)
		totalScore += res.Score
		count++
	}

	if count > 0 {
		fmt.Printf("\n✨ Evaluation Complete: Run %d tests. Aggregate Score: %.2f\n", count, totalScore/float64(count))
	} else {
		fmt.Println("\n⚠️ No tests found.")
	}
}

func compareEval() {
	compareCmd := flag.NewFlagSet("compare", flag.ExitOnError)
	baselineFile := compareCmd.String("baseline", "", "Path to baseline result file")
	compareCmd.Parse(os.Args[2:])

	dataRoot := os.Getenv("REACH_DATA_DIR")
	if dataRoot == "" {
		dataRoot = "data"
	}
	resultsDir := filepath.Join(dataRoot, "evaluation", "results")

	files, err := filepath.Glob(filepath.Join(resultsDir, "*.json"))
	if err != nil || len(files) == 0 {
		fmt.Println("No evaluation results found to compare.")
		return
	}

	// Group and sort results by test name and timestamp
	type resEntry struct {
		path string
		ts   int64
		res  evaluation.ScoringResult
	}
	byTest := make(map[string][]resEntry)

	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		var res evaluation.ScoringResult
		if err := json.Unmarshal(b, &res); err != nil {
			continue
		}

		// Strictly filter for evaluation runs
		if !strings.HasPrefix(res.RunID, "eval-") {
			continue
		}

		// Extract test ID from runID (eval-{testID}-{ts})
		// We want everything between the first "eval-" and the last hyphen
		parts := strings.Split(res.RunID, "-")
		if len(parts) < 3 {
			continue
		}
		testID := strings.Join(parts[1:len(parts)-1], "-")

		info, _ := os.Stat(f)
		byTest[testID] = append(byTest[testID], resEntry{path: f, ts: info.ModTime().Unix(), res: res})
	}

	fmt.Printf("\n🔍 Reach Drift Detection Report\n")
	fmt.Printf("%-20s | %-10s | %-10s | %-10s\n", "Test ID", "Baseline", "Current", "Delta")
	fmt.Println(strings.Repeat("-", 60))

	var regressions int
	for testID, entries := range byTest {
		// Sort by timestamp descending
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].ts > entries[j].ts
		})

		current := entries[0].res
		var baseline evaluation.ScoringResult
		foundBaseline := false

		if *baselineFile != "" {
			// Load specific baseline
			b, err := os.ReadFile(*baselineFile)
			if err == nil {
				json.Unmarshal(b, &baseline)
				foundBaseline = true
			}
		} else if len(entries) > 1 {
			// Use second latest as baseline
			baseline = entries[1].res
			foundBaseline = true
		}

		if foundBaseline {
			delta := current.Score - baseline.Score
			status := "CORRECTED"
			if delta < 0 {
				status = "REGRESSION"
				regressions++
			} else if delta == 0 {
				status = "STABLE"
			}

			fmt.Printf("%-20s | %10.2f | %10.2f | %10.2f [%s]\n", testID, baseline.Score, current.Score, delta, status)
		} else {
			fmt.Printf("%-20s | %10s | %10.2f | %10s\n", testID, "N/A", current.Score, "NEW")
		}
	}

	if regressions > 0 {
		fmt.Printf("\n⚠️ Alert: %d regressions detected!\n", regressions)
		os.Exit(1)
	} else {
		fmt.Println("\n✅ No regressions detected.")
	}
}

func suggestRAG() {
	fmt.Println("RAG optimization: suggesting improvements...")
}
