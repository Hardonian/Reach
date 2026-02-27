package main

// policy_cmd.go — Phase C: Trust Policy DSL CLI
//
// Commands:
//   reachctl policy evaluate <runId>
//   reachctl policy enforce --on <branch> [--policy <file>]
//   reachctl policy show [--policy <file>]

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"reach/services/runner/internal/governance"
)

// runPolicyCommand dispatches `reachctl policy <subcommand>`.
func runPolicyCommand(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usagePolicy(errOut)
		return 1
	}

	switch args[0] {
	case "evaluate":
		return runPolicyEvaluate(ctx, dataRoot, args[1:], out, errOut)
	case "enforce":
		return runPolicyEnforce(ctx, dataRoot, args[1:], out, errOut)
	case "show":
		return runPolicyShow(ctx, dataRoot, args[1:], out, errOut)
	default:
		_, _ = fmt.Fprintf(errOut, "unknown policy subcommand: %q\n", args[0])
		usagePolicy(errOut)
		return 1
	}
}

// runPolicyEvaluate evaluates the workspace policy against a specific run.
func runPolicyEvaluate(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("policy evaluate", flag.ContinueOnError)
	fs.SetOutput(errOut)
	policyFile := fs.String("policy", "", "Path to policy file (default: reach-policy.txt in data dir)")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl policy evaluate <runId> [--policy <file>] [--json]")
		return 1
	}
	runID := remaining[0]

	pol, err := loadWorkspacePolicy(dataRoot, *policyFile)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error loading policy: %v\n", err)
		return 1
	}

	rec, err := loadRunRecord(dataRoot, runID)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "run not found: %v\n", err)
		return 1
	}

	input := buildEvaluationInput(rec)
	result := pol.Evaluate(input)

	// Store evaluation result
	resultPath := filepath.Join(dataRoot, "policy", runID+".eval.json")
	if err := os.MkdirAll(filepath.Dir(resultPath), 0o755); err == nil {
		_ = writeDeterministicJSON(resultPath, result)
	}

	if *jsonFlag {
		return writeJSON(out, result)
	}

	symbol := "✓"
	if !result.Allowed {
		symbol = "✗"
	}
	_, _ = fmt.Fprintf(out, "Policy Evaluation: %s %s\n", symbol, runID)
	_, _ = fmt.Fprintf(out, "Policy Fingerprint: %s\n", result.PolicyFingerprint)
	_, _ = fmt.Fprintf(out, "Decision:           %s\n\n", map[bool]string{true: "ALLOWED", false: "DENIED"}[result.Allowed])
	if len(result.Violations) > 0 {
		_, _ = fmt.Fprintln(out, "Violations:")
		for _, v := range result.Violations {
			_, _ = fmt.Fprintf(out, "  [%s] %s\n", v.Code, v.Message)
		}
	} else {
		_, _ = fmt.Fprintln(out, "No violations found.")
	}
	_, _ = fmt.Fprintf(out, "\n%s\n", result.Summary)

	if !result.Allowed {
		return 1
	}
	return 0
}

// runPolicyEnforce enforces the policy status for a branch.
// It scans all runs and reports which would be denied under the current policy.
func runPolicyEnforce(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("policy enforce", flag.ContinueOnError)
	fs.SetOutput(errOut)
	branchFlag := fs.String("on", "main", "Branch to enforce policy on")
	policyFile := fs.String("policy", "", "Path to policy file")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	dryRun := fs.Bool("dry-run", false, "Show violations without failing")
	_ = fs.Parse(args)

	pol, err := loadWorkspacePolicy(dataRoot, *policyFile)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error loading policy: %v\n", err)
		return 1
	}

	runsDir := filepath.Join(dataRoot, "runs")
	entries, _ := os.ReadDir(runsDir)

	type enforceResult struct {
		RunID   string                      `json:"run_id"`
		Allowed bool                        `json:"allowed"`
		Result  governance.EvaluationResult `json:"result"`
	}
	var results []enforceResult
	deniedCount := 0

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), ".json")
		rec, err := loadRunRecord(dataRoot, id)
		if err != nil {
			continue
		}
		input := buildEvaluationInput(rec)
		input.Branch = *branchFlag
		result := pol.Evaluate(input)
		results = append(results, enforceResult{RunID: id, Allowed: result.Allowed, Result: result})
		if !result.Allowed {
			deniedCount++
		}
	}

	if *jsonFlag {
		return writeJSON(out, map[string]any{
			"branch":      *branchFlag,
			"policy_fp":   pol.Fingerprint(),
			"total_runs":  len(results),
			"denied_runs": deniedCount,
			"dry_run":     *dryRun,
			"run_results": results,
		})
	}

	_, _ = fmt.Fprintf(out, "Policy Enforcement: branch=%s\n", *branchFlag)
	_, _ = fmt.Fprintf(out, "Policy: %s\n", pol.Fingerprint())
	_, _ = fmt.Fprintf(out, "Runs evaluated: %d  Denied: %d\n\n", len(results), deniedCount)
	for _, r := range results {
		if !r.Allowed {
			_, _ = fmt.Fprintf(out, "  ✗ %s: %s\n", r.RunID, r.Result.Summary)
		}
	}
	if deniedCount == 0 {
		_, _ = fmt.Fprintln(out, "✓ All runs pass policy.")
	}

	if !*dryRun && deniedCount > 0 {
		return 1
	}
	return 0
}

// runPolicyShow prints the active policy configuration.
func runPolicyShow(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("policy show", flag.ContinueOnError)
	fs.SetOutput(errOut)
	policyFile := fs.String("policy", "", "Path to policy file")
	jsonFlag := fs.Bool("json", false, "Output JSON")
	_ = fs.Parse(args)

	pol, err := loadWorkspacePolicy(dataRoot, *policyFile)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "error: %v\n", err)
		return 1
	}

	if *jsonFlag {
		return writeJSON(out, map[string]any{
			"version":                   pol.Version,
			"fingerprint":               pol.Fingerprint(),
			"require_deterministic":     pol.RequireDeterministic,
			"require_signed":            pol.RequireSigned,
			"max_external_dependencies": pol.MaxExternalDependencies,
			"require_plugin_pinned":     pol.RequirePluginPinned,
			"min_reproducibility_rate":  pol.MinReproducibilityRate,
			"forbid_chaos_on_main":      pol.ForbidChaosOnMain,
		})
	}

	_, _ = fmt.Fprintln(out, "Active Governance Policy")
	_, _ = fmt.Fprintln(out, "========================")
	_, _ = fmt.Fprintf(out, "Version:                  %d\n", pol.Version)
	_, _ = fmt.Fprintf(out, "Fingerprint:              %s\n", pol.Fingerprint())
	_, _ = fmt.Fprintf(out, "Require deterministic:    %v\n", pol.RequireDeterministic)
	_, _ = fmt.Fprintf(out, "Require signed:           %v\n", pol.RequireSigned)
	_, _ = fmt.Fprintf(out, "Max external deps:        %d\n", pol.MaxExternalDependencies)
	_, _ = fmt.Fprintf(out, "Require plugin pinned:    %v\n", pol.RequirePluginPinned)
	_, _ = fmt.Fprintf(out, "Min reproducibility:      %d%%\n", pol.MinReproducibilityRate)
	_, _ = fmt.Fprintf(out, "Forbid chaos on main:     %v\n", pol.ForbidChaosOnMain)
	return 0
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// loadWorkspacePolicy loads the policy from a file or returns the default.
func loadWorkspacePolicy(dataRoot, overridePath string) (*governance.Policy, error) {
	if overridePath != "" {
		return governance.LoadPolicy(overridePath)
	}
	// Look in data dir first, then workspace root
	candidates := []string{
		filepath.Join(dataRoot, "reach-policy.txt"),
		"reach-policy.txt",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return governance.LoadPolicy(c)
		}
	}
	return governance.DefaultPolicy(), nil
}

// buildEvaluationInput extracts policy evaluation context from a run record.
func buildEvaluationInput(rec runRecord) governance.EvaluationInput {
	isDet := false
	if d, ok := rec.Pack["deterministic"].(bool); ok {
		isDet = d
	}
	isSigned := false
	if s, ok := rec.Pack["signature_hash"].(string); ok && s != "" {
		isSigned = true
	}
	extDeps := 0
	if d, ok := rec.Pack["external_deps"].(float64); ok {
		extDeps = int(d)
	}
	allPinned := true
	if p, ok := rec.Pack["all_plugins_pinned"].(bool); ok {
		allPinned = p
	}
	return governance.EvaluationInput{
		RunID:                   rec.RunID,
		IsDeterministic:         isDet,
		IsSigned:                isSigned,
		ExternalDependencyCount: extDeps,
		AllPluginsPinned:        allPinned,
		ReproducibilityScore:    -1, // -1 = not yet measured
	}
}

func usagePolicy(out io.Writer) {
	_, _ = io.WriteString(out, `usage: reach policy <command> [options]

Commands:
  evaluate <runId>              Evaluate policy against a specific run
  enforce --on <branch>         Enforce policy across all runs on a branch
  show                          Display the active policy configuration

Options:
  --policy <file>               Path to policy file (default: reach-policy.txt)
  --json                        Output JSON
  --dry-run                     Show results without failing

Policy File Format (reach-policy.txt):
  version = 1
  require_deterministic = true
  require_signed = false
  max_external_dependencies = 5
  require_plugin_pinned = true
  min_reproducibility_rate = 90
  forbid_chaos_on_main = true

Examples:
  reach policy show
  reach policy evaluate run-abc123 --json
  reach policy enforce --on main --dry-run
`)
}
