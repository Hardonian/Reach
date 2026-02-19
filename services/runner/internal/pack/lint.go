package pack

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// LintResult represents the outcome of a pack lint operation.
type LintResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
	Metadata Metadata `json:"metadata"`
}

// Metadata from the pack manifest.
type Metadata struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ExecutionGraph represents the logic of the pack.
type ExecutionGraph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Node struct {
	ID   string `json:"id"`
	Type string `json:"type"` // Action, Condition, Parallel
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// PackManifest represents the structure of a .reachpack or its JSON definition.
type PackManifest struct {
	Metadata            Metadata       `json:"metadata"`
	SpecVersion         string         `json:"specVersion"`
	DeclaredTools       []string       `json:"declared_tools"`
	DeclaredPermissions []string       `json:"declared_permissions"`
	ExecutionGraph      ExecutionGraph `json:"execution_graph"`
	Deterministic       bool           `json:"deterministic"`
}

// Lint performs static analysis on a pack file.
func Lint(path string) (*LintResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var manifest PackManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return &LintResult{
			Valid:  false,
			Errors: []string{fmt.Sprintf("JSON parse error: %v", err)},
		}, nil
	}

	res := &LintResult{
		Valid:    true,
		Metadata: manifest.Metadata,
		Errors:   []string{},
		Warnings: []string{},
	}

	// 1. Spec Version Check
	if manifest.SpecVersion == "" {
		res.Errors = append(res.Errors, "missing 'specVersion' field")
	} else if !strings.HasPrefix(manifest.SpecVersion, "1.") {
		res.Warnings = append(res.Warnings, fmt.Sprintf("unsupported specVersion: %s, expected 1.x", manifest.SpecVersion))
	}

	// 2. Permission Audit
	for _, perm := range manifest.DeclaredPermissions {
		if strings.HasPrefix(perm, "sys:") {
			res.Warnings = append(res.Warnings, fmt.Sprintf("pack requests system permission: %s", perm))
		}
	}

	// 4. Tool Registry Audit
	for _, tool := range manifest.DeclaredTools {
		if len(tool) > 128 {
			res.Errors = append(res.Errors, fmt.Sprintf("tool name too long: %s", tool))
		}
	}
	if len(manifest.ExecutionGraph.Nodes) > 500 {
		res.Warnings = append(res.Warnings, "large execution graph (>500 nodes); may impact performance")
	}

	if checkAcyclic(manifest.ExecutionGraph) {
		res.Errors = append(res.Errors, "execution graph contains cycles; it must be a DAG")
	}

	if len(res.Errors) > 0 {
		res.Valid = false
	}

	return res, nil
}

func checkAcyclic(g ExecutionGraph) bool {
	if len(g.Nodes) == 0 {
		return false
	}

	adj := make(map[string][]string)
	for _, edge := range g.Edges {
		adj[edge.From] = append(adj[edge.From], edge.To)
	}

	visited := make(map[string]bool)
	onStack := make(map[string]bool)

	var dfs func(string, int) bool
	dfs = func(u string, depth int) bool {
		if depth > 1000 {
			return true // Treat extreme depth as a cycle/error for safety
		}
		visited[u] = true
		onStack[u] = true

		for _, v := range adj[u] {
			if !visited[v] {
				if dfs(v, depth+1) {
					return true
				}
			} else if onStack[v] {
				return true
			}
		}

		onStack[u] = false
		return false
	}

	for _, node := range g.Nodes {
		if !visited[node.ID] {
			if dfs(node.ID, 0) {
				return true
			}
		}
	}

	return false
}
