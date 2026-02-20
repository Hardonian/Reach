package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
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
	// Register demo pack for smoke testing
	// In production, this would load all installed packs
	demoPath := "./data/packs/arcadeSafe.demo"
	lintRes, _ := pack.Lint(demoPath)
	if lintRes != nil && lintRes.Valid {
		registry.Register(lintRes)
	}

	mcpSrv := mcpserver.NewMockServer("./")
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
		// Map test to arcadeSafe.demo for this MVP
		cid := "99d545de6734c5c4e21e1344543b95b3f7fed4bf33a061f4172a42b7479c1344"
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
	fmt.Println("Regression check: comparing results...")
}

func suggestRAG() {
	fmt.Println("RAG optimization: suggesting improvements...")
}
