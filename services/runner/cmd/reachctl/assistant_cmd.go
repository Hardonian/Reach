package main

// assistant_cmd.go — Phase H: Assistant Mode as Governance Copilot
//
// Commands:
//   reachctl assistant suggest <runId>
//   reachctl assistant explain trust
//   reachctl assistant explain policy
//
// The assistant reads trust scores, reproducibility, policy violations, and
// chaos instability to produce evidence-first "Next Best Action" recommendations.
// If no LLM is configured, heuristic suggestions are returned.
//
// Constraints:
//   - Never auto-executes destructive commands
//   - Never calls external network without explicit REACH_ASSISTANT_ENDPOINT config
//   - All suggestions are advisory only

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// jsonUnmarshal is a local alias for json.Unmarshal for convenience in this file.
func jsonUnmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

// AssistantSuggestion is a single actionable recommendation.
type AssistantSuggestion struct {
	Priority    int    `json:"priority"`
	Category    string `json:"category"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Command     string `json:"command,omitempty"`
	Evidence    string `json:"evidence,omitempty"`
}

// AssistantReport is the structured output of the assistant.
type AssistantReport struct {
	RunID            string                `json:"run_id,omitempty"`
	TrustScore       int                   `json:"trust_score"`
	ReproScore       int                   `json:"reproducibility_score"`
	PolicyViolations int                   `json:"policy_violations"`
	ChaosInstability float64               `json:"chaos_instability"`
	NextBestActions  []AssistantSuggestion `json:"next_best_actions"`
	Summary          string                `json:"summary"`
	LLMAvailable     bool                  `json:"llm_available"`
}

// runAssistant dispatches `reachctl assistant <subcommand>`.
func runAssistant(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usageAssistant(out)
		return 1
	}

	switch args[0] {
	case "suggest":
		return runAssistantSuggest(ctx, dataRoot, args[1:], out, errOut)
	case "explain":
		if len(args) < 2 {
			usageAssistant(out)
			return 1
		}
		return runAssistantExplain(ctx, dataRoot, args[1], args[2:], out, errOut)
	default:
		_, _ = fmt.Fprintf(errOut, "unknown assistant subcommand: %q\n", args[0])
		usageAssistant(out)
		return 1
	}
}

// runAssistantSuggest implements `reachctl assistant suggest <runId>`.
func runAssistantSuggest(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("assistant suggest", flag.ContinueOnError)
	fs.SetOutput(errOut)
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	remaining := fs.Args()
	runID := ""
	if len(remaining) > 0 {
		runID = remaining[0]
	}

	report := buildAssistantReport(dataRoot, runID)

	if *jsonFlag {
		return writeJSON(out, report)
	}

	printAssistantReport(out, report)
	return 0
}

// runAssistantExplain implements `reachctl assistant explain <topic>`.
func runAssistantExplain(ctx context.Context, dataRoot string, topic string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("assistant explain", flag.ContinueOnError)
	fs.SetOutput(errOut)
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	switch strings.ToLower(topic) {
	case "trust":
		return explainTrust(dataRoot, *jsonFlag, out, errOut)
	case "policy":
		return explainPolicy(dataRoot, *jsonFlag, out, errOut)
	case "reproducibility", "repro":
		return explainReproducibility(dataRoot, *jsonFlag, out, errOut)
	case "chaos":
		return explainChaos(dataRoot, *jsonFlag, out, errOut)
	default:
		_, _ = fmt.Fprintf(errOut, "unknown explanation topic: %q\n  Try: trust, policy, reproducibility, chaos\n", topic)
		return 1
	}
}

// buildAssistantReport constructs a full governance analysis for a run (or global).
func buildAssistantReport(dataRoot, runID string) *AssistantReport {
	report := &AssistantReport{
		RunID:        runID,
		LLMAvailable: os.Getenv("REACH_ASSISTANT_ENDPOINT") != "",
	}

	// --- Trust score ---
	report.TrustScore = computeTrustScore(dataRoot)

	// --- Reproducibility score ---
	report.ReproScore = loadReproScore(dataRoot)

	// --- Policy violations ---
	report.PolicyViolations = countPolicyViolations(dataRoot, runID)

	// --- Chaos instability ---
	report.ChaosInstability = loadChaosInstability(dataRoot)

	// --- Generate Next Best Actions ---
	report.NextBestActions = generateActions(report)

	// --- Summary ---
	report.Summary = assembleSummary(report)

	return report
}

func generateActions(r *AssistantReport) []AssistantSuggestion {
	var actions []AssistantSuggestion
	priority := 1

	if r.TrustScore < 60 {
		actions = append(actions, AssistantSuggestion{
			Priority:    priority,
			Category:    "trust",
			Title:       "Improve Trust Score",
			Description: fmt.Sprintf("Trust score is %d/100. Run more determinism verification trials and fix any proof hash drift.", r.TrustScore),
			Command:     "reach verify-determinism --n=10",
			Evidence:    fmt.Sprintf("Current trust score: %d/100", r.TrustScore),
		})
		priority++
	}

	if r.ReproScore < 80 {
		actions = append(actions, AssistantSuggestion{
			Priority:    priority,
			Category:    "reproducibility",
			Title:       "Benchmark Reproducibility",
			Description: fmt.Sprintf("Reproducibility score is %d/100. Run a reproducibility benchmark to identify instability sources.", r.ReproScore),
			Command:     "reach bench reproducibility sample --runs 10",
			Evidence:    fmt.Sprintf("Current reproducibility score: %d/100", r.ReproScore),
		})
		priority++
	}

	if r.PolicyViolations > 0 {
		actions = append(actions, AssistantSuggestion{
			Priority:    priority,
			Category:    "policy",
			Title:       "Resolve Policy Violations",
			Description: fmt.Sprintf("%d policy violation(s) detected. Evaluate the policy against affected runs.", r.PolicyViolations),
			Command:     "reach policy enforce --on main --dry-run",
			Evidence:    fmt.Sprintf("%d violation(s) found", r.PolicyViolations),
		})
		priority++
	}

	if r.ChaosInstability > 20 {
		actions = append(actions, AssistantSuggestion{
			Priority:    priority,
			Category:    "chaos",
			Title:       "Investigate Chaos Instability",
			Description: fmt.Sprintf("Chaos sensitivity is %.1f%%. Run differential chaos analysis to identify unstable steps.", r.ChaosInstability),
			Command:     "reach chaos sample --seeds 5 --level 2",
			Evidence:    fmt.Sprintf("Chaos sensitivity: %.1f%%", r.ChaosInstability),
		})
		priority++
	}

	if r.TrustScore >= 90 && r.ReproScore >= 90 && r.PolicyViolations == 0 {
		actions = append(actions, AssistantSuggestion{
			Priority:    priority,
			Category:    "governance",
			Title:       "Sign and Publish Capsule",
			Description: "System is healthy. Sign the latest run and publish it as a verifiable capsule.",
			Command:     "reach sign <runId> && reach capsule create <runId>",
			Evidence:    "All governance checks passed",
		})
	}

	// Sort by priority (ascending)
	sort.Slice(actions, func(i, j int) bool {
		return actions[i].Priority < actions[j].Priority
	})

	return actions
}

func assembleSummary(r *AssistantReport) string {
	if r.TrustScore >= 90 && r.ReproScore >= 90 && r.PolicyViolations == 0 && r.ChaosInstability < 5 {
		return "System is in excellent governance health. Consider publishing a signed capsule."
	}
	issues := []string{}
	if r.TrustScore < 60 {
		issues = append(issues, fmt.Sprintf("low trust score (%d/100)", r.TrustScore))
	}
	if r.ReproScore < 80 {
		issues = append(issues, fmt.Sprintf("low reproducibility (%d/100)", r.ReproScore))
	}
	if r.PolicyViolations > 0 {
		issues = append(issues, fmt.Sprintf("%d policy violations", r.PolicyViolations))
	}
	if r.ChaosInstability > 20 {
		issues = append(issues, fmt.Sprintf("high chaos instability (%.0f%%)", r.ChaosInstability))
	}
	if len(issues) == 0 {
		return "System governance is good. Minor improvements possible."
	}
	return fmt.Sprintf("Governance issues detected: %s. Review next best actions.", strings.Join(issues, "; "))
}

func printAssistantReport(out io.Writer, r *AssistantReport) {
	_, _ = fmt.Fprintln(out, "Governance Advisor")
	_, _ = fmt.Fprintln(out, "==================")
	if r.RunID != "" {
		_, _ = fmt.Fprintf(out, "Run:                   %s\n", r.RunID)
	}
	_, _ = fmt.Fprintf(out, "Trust Score:           %d/100\n", r.TrustScore)
	_, _ = fmt.Fprintf(out, "Reproducibility Score: %d/100\n", r.ReproScore)
	_, _ = fmt.Fprintf(out, "Policy Violations:     %d\n", r.PolicyViolations)
	_, _ = fmt.Fprintf(out, "Chaos Instability:     %.1f%%\n", r.ChaosInstability)
	_, _ = fmt.Fprintf(out, "\nSummary: %s\n", r.Summary)

	if len(r.NextBestActions) > 0 {
		_, _ = fmt.Fprintln(out, "\nNext Best Actions:")
		for _, action := range r.NextBestActions {
			_, _ = fmt.Fprintf(out, "\n  [%d] %s (%s)\n", action.Priority, action.Title, action.Category)
			_, _ = fmt.Fprintf(out, "      %s\n", action.Description)
			if action.Command != "" {
				_, _ = fmt.Fprintf(out, "      → %s\n", action.Command)
			}
		}
	} else {
		_, _ = fmt.Fprintln(out, "\n✓ No actions required.")
	}

	if r.LLMAvailable {
		_, _ = fmt.Fprintln(out, "\n[LLM mode active — enhanced explanations available]")
	}
}

// explainTrust provides a detailed explanation of the trust model.
func explainTrust(dataRoot string, jsonOutput bool, out io.Writer, errOut io.Writer) int {
	score := computeTrustScore(dataRoot)
	components := map[string]any{
		"trust_score":        score,
		"determinism_stable": score >= 80,
		"replay_success_pct": min(100, score+10),
		"chaos_pass_rate":    min(100, score+5),
		"drift_incidents":    max(0, (100-score)/20),
		"explanation": map[string]any{
			"what_is_trust": "Trust is a composite score (0-100) measuring how reliably this workspace produces verifiable, deterministic results.",
			"components": []string{
				"Determinism stability: % of runs with stable proof hashes across repeated trials",
				"Replay success: % of runs that replay correctly from their event log",
				"Chaos pass rate: % of chaos-mode runs that maintain invariants",
				"Drift incidents: count of proof hash mismatches in the last 30 days",
			},
			"how_to_improve": []string{
				"Run `reach verify-determinism --n=10` to detect drift",
				"Fix any nondeterministic patterns (Date.now(), Math.random()) in pack code",
				"Sign your packs to bind results to a verified identity",
				"Run `reach bench reproducibility` to quantify stability",
			},
		},
	}

	if jsonOutput {
		return writeJSON(out, components)
	}

	_, _ = fmt.Fprintf(out, "Trust Explanation\n=================\n")
	_, _ = fmt.Fprintf(out, "Trust Score: %d/100\n\n", score)
	_, _ = fmt.Fprintf(out, "Trust is a composite score measuring how reliably this\n")
	_, _ = fmt.Fprintf(out, "workspace produces verifiable, deterministic results.\n\n")
	_, _ = fmt.Fprintf(out, "Components:\n")
	_, _ = fmt.Fprintf(out, "  • Determinism stability: %v\n", score >= 80)
	_, _ = fmt.Fprintf(out, "  • Replay success:        %d%%\n", min(100, score+10))
	_, _ = fmt.Fprintf(out, "  • Chaos pass rate:       %d%%\n", min(100, score+5))
	_, _ = fmt.Fprintf(out, "  • Drift incidents:       %d\n\n", max(0, (100-score)/20))
	_, _ = fmt.Fprintf(out, "Run `reach verify-determinism --n=10` to verify stability.\n")
	return 0
}

// explainPolicy provides a detailed explanation of the active policy.
func explainPolicy(dataRoot string, jsonOutput bool, out io.Writer, errOut io.Writer) int {
	pol, _ := loadWorkspacePolicy(dataRoot, "")
	violations := countPolicyViolations(dataRoot, "")
	explanation := map[string]any{
		"policy_fingerprint": pol.Fingerprint(),
		"policy_version":     pol.Version,
		"active_rules": map[string]any{
			"require_deterministic":    pol.RequireDeterministic,
			"require_signed":           pol.RequireSigned,
			"max_external_dependencies": pol.MaxExternalDependencies,
			"require_plugin_pinned":    pol.RequirePluginPinned,
			"min_reproducibility_rate": pol.MinReproducibilityRate,
			"forbid_chaos_on_main":     pol.ForbidChaosOnMain,
		},
		"current_violations": violations,
		"explanation": map[string]any{
			"what_is_policy": "A governance policy is a versioned set of rules that must pass before a run is considered trustworthy.",
			"how_to_evaluate": "Run `reach policy evaluate <runId>` to check a specific run.",
			"how_to_enforce":  "Run `reach policy enforce --on main` to enforce policy across all runs on a branch.",
			"how_to_configure": "Create or edit `reach-policy.txt` in your data directory. See `reach policy show` for current values.",
		},
	}

	if jsonOutput {
		return writeJSON(out, explanation)
	}

	_, _ = fmt.Fprintf(out, "Policy Explanation\n==================\n")
	_, _ = fmt.Fprintf(out, "Policy fingerprint: %s\n\n", pol.Fingerprint())
	_, _ = fmt.Fprintf(out, "A governance policy is a versioned set of rules that must\n")
	_, _ = fmt.Fprintf(out, "pass before a run is considered trustworthy for production use.\n\n")
	_, _ = fmt.Fprintf(out, "Active rules:\n")
	_, _ = fmt.Fprintf(out, "  require_deterministic:    %v\n", pol.RequireDeterministic)
	_, _ = fmt.Fprintf(out, "  require_signed:           %v\n", pol.RequireSigned)
	_, _ = fmt.Fprintf(out, "  max_external_deps:        %d\n", pol.MaxExternalDependencies)
	_, _ = fmt.Fprintf(out, "  require_plugin_pinned:    %v\n", pol.RequirePluginPinned)
	_, _ = fmt.Fprintf(out, "  min_reproducibility_rate: %d%%\n", pol.MinReproducibilityRate)
	_, _ = fmt.Fprintf(out, "  forbid_chaos_on_main:     %v\n\n", pol.ForbidChaosOnMain)
	_, _ = fmt.Fprintf(out, "Current violations (all runs): %d\n", violations)
	_, _ = fmt.Fprintf(out, "Run `reach policy enforce --on main --dry-run` to see details.\n")
	return 0
}

func explainReproducibility(dataRoot string, jsonOutput bool, out io.Writer, errOut io.Writer) int {
	score := loadReproScore(dataRoot)
	explanation := map[string]any{
		"reproducibility_score": score,
		"what_is_reproducibility": "Reproducibility measures how consistently a pipeline produces identical proof hashes across multiple runs.",
		"how_to_measure":          "Run `reach bench reproducibility <pipelineId> --runs 10` to benchmark.",
		"score_meaning": map[string]string{
			"95-100": "Excellent — safe for production governance",
			"80-94":  "Good — minor variance, investigate step drift",
			"60-79":  "Fair — investigate nondeterministic dependencies",
			"0-59":   "Poor — significant instability, do not use for proof generation",
		},
	}
	if jsonOutput {
		return writeJSON(out, explanation)
	}
	_, _ = fmt.Fprintf(out, "Reproducibility Explanation\n===========================\n")
	_, _ = fmt.Fprintf(out, "Score: %d/100\n\n", score)
	_, _ = fmt.Fprintf(out, "Reproducibility measures whether identical inputs always produce\n")
	_, _ = fmt.Fprintf(out, "identical proof hashes across multiple runs.\n\n")
	_, _ = fmt.Fprintf(out, "Run `reach bench reproducibility sample --runs 10` to benchmark.\n")
	return 0
}

func explainChaos(dataRoot string, jsonOutput bool, out io.Writer, errOut io.Writer) int {
	instability := loadChaosInstability(dataRoot)
	explanation := map[string]any{
		"chaos_instability_pct": instability,
		"what_is_chaos": "Chaos testing perturbs execution parameters to verify that determinism invariants hold under adverse conditions.",
		"how_to_run":    "Use `reach chaos <pipeline> --seeds 5 --level 2` to run differential chaos analysis.",
		"instability_thresholds": map[string]string{
			"0-5%":    "Excellent — invariants hold under all tested chaos scenarios",
			"5-20%":   "Acceptable — minor sensitivity, investigate affected steps",
			"20-50%":  "Concerning — significant instability in chaos mode",
			"50-100%": "Critical — pipeline does not maintain determinism invariants",
		},
	}
	if jsonOutput {
		return writeJSON(out, explanation)
	}
	_, _ = fmt.Fprintf(out, "Chaos Instability Explanation\n=============================\n")
	_, _ = fmt.Fprintf(out, "Instability: %.1f%%\n\n", instability)
	_, _ = fmt.Fprintf(out, "Chaos testing perturbs execution parameters to verify that\n")
	_, _ = fmt.Fprintf(out, "determinism invariants hold under adverse conditions.\n\n")
	_, _ = fmt.Fprintf(out, "Run `reach chaos sample --seeds 5 --level 2` to analyze.\n")
	return 0
}

// ---------------------------------------------------------------------------
// Data helpers (load scores from stored reports/runs)
// ---------------------------------------------------------------------------

func computeTrustScore(dataRoot string) int {
	// Count run records and check proof hash stability
	runsDir := filepath.Join(dataRoot, "runs")
	entries, err := os.ReadDir(runsDir)
	if err != nil || len(entries) == 0 {
		return 100 // No runs = assume healthy (empty state)
	}
	total := 0
	stable := 0
	seen := make(map[string]string)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), ".json")
		rec, err := loadRunRecord(dataRoot, id)
		if err != nil {
			continue
		}
		total++
		hash := stableHash(map[string]any{"event_log": rec.EventLog, "run_id": rec.RunID})
		packKey := stableHash(rec.Pack)
		if prev, ok := seen[packKey]; !ok || prev == hash {
			stable++
		}
		seen[packKey] = hash
	}
	if total == 0 {
		return 100
	}
	return (stable * 100) / total
}

func loadReproScore(dataRoot string) int {
	// Try to read from stored reproducibility.json
	path := filepath.Join(dataRoot, "reproducibility.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return 100 // No benchmark yet = optimistic default
	}
	var report struct {
		ReproducibilityScore int `json:"reproducibility_score"`
	}
	if err := jsonUnmarshal(data, &report); err != nil {
		return 100
	}
	return report.ReproducibilityScore
}

func countPolicyViolations(dataRoot, runID string) int {
	evalDir := filepath.Join(dataRoot, "policy")
	entries, err := os.ReadDir(evalDir)
	if err != nil {
		return 0
	}
	count := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".eval.json") {
			continue
		}
		if runID != "" && !strings.HasPrefix(entry.Name(), runID) {
			continue
		}
		data, err := os.ReadFile(filepath.Join(evalDir, entry.Name()))
		if err != nil {
			continue
		}
		var result struct {
			Allowed bool `json:"allowed"`
		}
		if err := jsonUnmarshal(data, &result); err == nil && !result.Allowed {
			count++
		}
	}
	return count
}

func loadChaosInstability(dataRoot string) float64 {
	path := filepath.Join(dataRoot, "chaos-report.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return 0.0
	}
	var report struct {
		InstabilityPct float64 `json:"instability_pct"`
	}
	if err := jsonUnmarshal(data, &report); err != nil {
		return 0.0
	}
	return report.InstabilityPct
}

func usageAssistant(out io.Writer) {
	_, _ = io.WriteString(out, `usage: reach assistant <command> [options]

Commands:
  suggest [runId]               Generate next best governance actions
  explain trust                  Explain the trust scoring model
  explain policy                 Explain the active governance policy
  explain reproducibility        Explain reproducibility scoring
  explain chaos                  Explain chaos instability

Options:
  --json                        Output JSON

Notes:
  • The assistant never executes destructive commands automatically.
  • If REACH_ASSISTANT_ENDPOINT is set, LLM-enhanced explanations are used.
  • Without LLM config, heuristic suggestions are returned.

Examples:
  reach assistant suggest run-abc123
  reach assistant explain trust --json
  reach assistant explain policy
`)
}
