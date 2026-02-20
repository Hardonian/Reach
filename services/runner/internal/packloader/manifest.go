// Package packloader provides a modular, sandboxed pack loading system
// for the Reach platform. Packs are the fundamental unit of extensibility:
// each pack declares its tools, permissions, and execution graph, and the
// loader ensures schema validation, integrity verification, isolation,
// version pinning, and failure containment.
package packloader

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// SchemaVersion is the current pack manifest schema version.
const SchemaVersion = "1.0.0"

// PackManifest is the canonical manifest for a Reach pack.
// It defines identity, capabilities, constraints, and the execution graph.
type PackManifest struct {
	// Schema version for forward compatibility.
	SchemaVersion string `json:"schema_version"`

	// Metadata identifies the pack.
	Metadata PackMetadata `json:"metadata"`

	// DeclaredTools is the allowlist of tool names this pack may invoke.
	DeclaredTools []string `json:"declared_tools"`

	// DeclaredPermissions is the allowlist of permission scopes.
	DeclaredPermissions []string `json:"declared_permissions"`

	// ModelRequirements specifies model constraints.
	ModelRequirements *ModelRequirements `json:"model_requirements,omitempty"`

	// ExecutionGraph defines the DAG of execution steps.
	ExecutionGraph *ExecutionGraph `json:"execution_graph,omitempty"`

	// Deterministic flags this pack as requiring deterministic execution.
	Deterministic bool `json:"deterministic"`

	// Dependencies lists other packs this pack depends on.
	Dependencies []PackDependency `json:"dependencies,omitempty"`

	// Exports lists capabilities this pack provides to other packs.
	Exports []string `json:"exports,omitempty"`

	// EntryPoint is the starting node ID in the execution graph.
	EntryPoint string `json:"entry_point,omitempty"`

	// SignatureHash is the SHA-256 hash of the manifest content (excluding this field).
	SignatureHash string `json:"signature_hash,omitempty"`
}

// PackMetadata identifies a pack uniquely.
type PackMetadata struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author,omitempty"`
	License     string `json:"license,omitempty"`
	Created     string `json:"created,omitempty"`
}

// PackDependency declares a dependency on another pack with version constraints.
type PackDependency struct {
	ID         string `json:"id"`
	Version    string `json:"version"`    // Exact version or semver range
	Optional   bool   `json:"optional"`   // If true, missing dep doesn't block loading
	MinVersion string `json:"min_version,omitempty"`
	MaxVersion string `json:"max_version,omitempty"`
}

// ModelRequirements specifies what model capabilities a pack needs.
type ModelRequirements struct {
	Tier          string `json:"tier,omitempty"`           // "low", "medium", "high"
	ContextWindow string `json:"context_window,omitempty"` // e.g. "128k"
}

// ExecutionGraph defines a DAG of execution nodes.
type ExecutionGraph struct {
	Nodes       map[string]GraphNode `json:"nodes"`
	Edges       []GraphEdge          `json:"edges"`
	StartNodeID string               `json:"start_node_id"`
}

// GraphNode is a single step in the execution graph.
type GraphNode struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"` // "action", "condition", "parallel"
	Name          string          `json:"name"`
	Config        json.RawMessage `json:"config,omitempty"`
	Deterministic bool            `json:"deterministic"`
}

// GraphEdge connects two nodes.
type GraphEdge struct {
	From      string  `json:"from"`
	To        string  `json:"to"`
	Type      string  `json:"type"`               // "default", "conditional", "fallback"
	Condition *string `json:"condition,omitempty"` // For conditional edges
}

// Validation regexes.
var (
	packIDRegex      = regexp.MustCompile(`^[a-z][a-z0-9._-]{2,127}$`)
	semverRegex      = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[a-zA-Z0-9._-]+)?(\+[a-zA-Z0-9._-]+)?$`)
	toolNameRegex    = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$`)
	permissionRegex  = regexp.MustCompile(`^[a-z][a-z0-9_]*:[a-z][a-z0-9_*]*$`)
)

// SchemaError represents a manifest schema validation error.
type SchemaError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *SchemaError) Error() string {
	return fmt.Sprintf("schema error in %s: %s", e.Field, e.Message)
}

// ValidationResult holds the outcome of manifest validation.
type ValidationResult struct {
	Valid    bool          `json:"valid"`
	Errors   []SchemaError `json:"errors,omitempty"`
	Warnings []string      `json:"warnings,omitempty"`
	Hash     string        `json:"hash,omitempty"`
}

// ValidateManifest performs comprehensive schema validation on a pack manifest.
// It checks all required fields, format constraints, and structural integrity.
func ValidateManifest(m *PackManifest) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Schema version
	if m.SchemaVersion == "" {
		result.addError("schema_version", "required")
	} else if !semverRegex.MatchString(m.SchemaVersion) {
		result.addError("schema_version", "must be valid semver")
	}

	// Metadata
	validateMetadata(&m.Metadata, result)

	// Tools
	validateTools(m.DeclaredTools, result)

	// Permissions
	validatePermissions(m.DeclaredPermissions, result)

	// Execution graph
	if m.ExecutionGraph != nil {
		validateGraph(m.ExecutionGraph, result)
	}

	// Dependencies
	validateDependencies(m.Dependencies, result)

	// Dangerous permissions warning
	for _, perm := range m.DeclaredPermissions {
		if strings.HasPrefix(perm, "sys:") {
			result.Warnings = append(result.Warnings, fmt.Sprintf("pack requests system permission: %s", perm))
		}
	}

	return result
}

func validateMetadata(meta *PackMetadata, r *ValidationResult) {
	if meta.ID == "" {
		r.addError("metadata.id", "required")
	} else if !packIDRegex.MatchString(meta.ID) {
		r.addError("metadata.id", "must match pattern: lowercase alphanumeric with dots, dashes, underscores (3-128 chars)")
	}

	if meta.Version == "" {
		r.addError("metadata.version", "required")
	} else if !semverRegex.MatchString(meta.Version) {
		r.addError("metadata.version", "must be valid semver (e.g. 1.0.0)")
	}

	if meta.Name == "" {
		r.addError("metadata.name", "required")
	} else if len(meta.Name) > 256 {
		r.addError("metadata.name", "must be <= 256 characters")
	}
}

func validateTools(tools []string, r *ValidationResult) {
	seen := make(map[string]bool)
	for i, tool := range tools {
		if tool == "" {
			r.addError(fmt.Sprintf("declared_tools[%d]", i), "empty tool name")
			continue
		}
		if !toolNameRegex.MatchString(tool) {
			r.addError(fmt.Sprintf("declared_tools[%d]", i), fmt.Sprintf("invalid tool name: %s", tool))
		}
		if seen[tool] {
			r.addError(fmt.Sprintf("declared_tools[%d]", i), fmt.Sprintf("duplicate tool: %s", tool))
		}
		seen[tool] = true
	}
}

func validatePermissions(perms []string, r *ValidationResult) {
	seen := make(map[string]bool)
	for i, perm := range perms {
		if perm == "" {
			r.addError(fmt.Sprintf("declared_permissions[%d]", i), "empty permission")
			continue
		}
		if !permissionRegex.MatchString(perm) {
			r.addError(fmt.Sprintf("declared_permissions[%d]", i), fmt.Sprintf("invalid permission format: %s (expected scope:action)", perm))
		}
		if seen[perm] {
			r.addError(fmt.Sprintf("declared_permissions[%d]", i), fmt.Sprintf("duplicate permission: %s", perm))
		}
		seen[perm] = true
	}
}

func validateGraph(g *ExecutionGraph, r *ValidationResult) {
	if len(g.Nodes) == 0 {
		r.addError("execution_graph.nodes", "graph must have at least one node")
		return
	}

	if g.StartNodeID == "" {
		r.addError("execution_graph.start_node_id", "required when graph is present")
	} else if _, ok := g.Nodes[g.StartNodeID]; !ok {
		r.addError("execution_graph.start_node_id", fmt.Sprintf("references unknown node: %s", g.StartNodeID))
	}

	// Validate edges reference valid nodes
	for i, edge := range g.Edges {
		if _, ok := g.Nodes[edge.From]; !ok {
			r.addError(fmt.Sprintf("execution_graph.edges[%d].from", i), fmt.Sprintf("references unknown node: %s", edge.From))
		}
		if _, ok := g.Nodes[edge.To]; !ok {
			r.addError(fmt.Sprintf("execution_graph.edges[%d].to", i), fmt.Sprintf("references unknown node: %s", edge.To))
		}
	}

	// Check for cycles
	if detectCycle(g) {
		r.addError("execution_graph", "contains cycles; must be a DAG")
	}

	if len(g.Nodes) > 500 {
		r.Warnings = append(r.Warnings, "large execution graph (>500 nodes); may impact performance")
	}
}

func validateDependencies(deps []PackDependency, r *ValidationResult) {
	seen := make(map[string]bool)
	for i, dep := range deps {
		if dep.ID == "" {
			r.addError(fmt.Sprintf("dependencies[%d].id", i), "required")
		}
		if dep.Version == "" && dep.MinVersion == "" {
			r.addError(fmt.Sprintf("dependencies[%d]", i), "version or min_version required")
		}
		if seen[dep.ID] {
			r.addError(fmt.Sprintf("dependencies[%d].id", i), fmt.Sprintf("duplicate dependency: %s", dep.ID))
		}
		seen[dep.ID] = true
	}
}

func (r *ValidationResult) addError(field, message string) {
	r.Valid = false
	r.Errors = append(r.Errors, SchemaError{Field: field, Message: message})
}

// detectCycle returns true if the execution graph contains a cycle.
func detectCycle(g *ExecutionGraph) bool {
	adj := make(map[string][]string)
	for _, edge := range g.Edges {
		adj[edge.From] = append(adj[edge.From], edge.To)
	}

	visited := make(map[string]bool)
	onStack := make(map[string]bool)

	var dfs func(string, int) bool
	dfs = func(u string, depth int) bool {
		if depth > 1000 {
			return true
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

	for id := range g.Nodes {
		if !visited[id] {
			if dfs(id, 0) {
				return true
			}
		}
	}

	return false
}

// ComputeHash computes a deterministic SHA-256 hash of the manifest content,
// excluding the signature_hash field itself.
func ComputeHash(m *PackManifest) (string, error) {
	clone := *m
	clone.SignatureHash = ""

	data, err := json.Marshal(clone)
	if err != nil {
		return "", fmt.Errorf("failed to marshal manifest: %w", err)
	}

	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:]), nil
}

// VerifyIntegrity checks if the manifest's signature hash matches its content.
func VerifyIntegrity(m *PackManifest) error {
	if m.SignatureHash == "" {
		return errors.New("manifest has no signature hash")
	}

	computed, err := ComputeHash(m)
	if err != nil {
		return fmt.Errorf("failed to compute hash: %w", err)
	}

	if computed != m.SignatureHash {
		return fmt.Errorf("integrity check failed: computed %s, expected %s", computed, m.SignatureHash)
	}

	return nil
}

// ParseManifest parses raw JSON into a validated PackManifest.
func ParseManifest(data []byte) (*PackManifest, *ValidationResult, error) {
	var m PackManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, nil, fmt.Errorf("invalid JSON: %w", err)
	}

	result := ValidateManifest(&m)

	hash, err := ComputeHash(&m)
	if err == nil {
		result.Hash = hash
	}

	return &m, result, nil
}
