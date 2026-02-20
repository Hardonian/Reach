package pack

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// PackQualityScore represents the calculated score for a pack.
type PackQualityScore struct {
	StabilityScore  float64 `json:"stability"`
	GroundingScore  float64 `json:"grounding"`
	ComplianceScore float64 `json:"compliance"`
	EfficiencyScore float64 `json:"efficiency"`
	ReputationScore float64 `json:"reputation_score"` // 0-100
}

// LintResult represents the outcome of a pack lint operation.
type LintResult struct {
	Valid       bool            `json:"valid"`
	Errors      []string        `json:"errors"`
	Warnings    []string        `json:"warnings"`
	Metadata    Metadata        `json:"metadata"`
	Hash        string          `json:"hash"`
	MerkleRoot  string          `json:"merkle_root,omitempty"`
	MerkleProof *MerkleProof    `json:"merkle_proof,omitempty"`
	Integrity   *PackIntegrity  `json:"integrity,omitempty"`
	Graph       *ExecutionGraph `json:"execution_graph,omitempty"`
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
	ID     string         `json:"id"`
	Type   string         `json:"type"` // Action, Condition, Parallel
	Tool   string         `json:"tool,omitempty"`
	Action string         `json:"action,omitempty"`
	Inputs map[string]any `json:"inputs,omitempty"`
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
		Graph:    &manifest.ExecutionGraph,
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

	// 4. Integrity Moat: Fingerprint the pack
	h := sha256.New()
	graphData, _ := json.Marshal(manifest.ExecutionGraph)
	h.Write(graphData)
	res.Hash = hex.EncodeToString(h.Sum(nil))

	// 5. Merkle Tree Integration: Content-addressed integrity
	integrity, err := ComputePackIntegrity(&manifest, graphData)
	if err != nil {
		res.Warnings = append(res.Warnings, fmt.Sprintf("merkle tree computation failed: %v", err))
	} else {
		res.MerkleRoot = integrity.MerkleRoot
		res.Integrity = integrity

		// Generate proof for execution graph (leaf index 3)
		proof, err := integrity.Tree.GetProof(3)
		if err == nil {
			res.MerkleProof = proof
		}
	}

	if len(res.Errors) > 0 {
		res.Valid = false
	}

	return res, nil
}

// LintWithMerkle performs linting with full Merkle tree verification.
func LintWithMerkle(path string, verifyProofs bool) (*LintResult, error) {
	res, err := Lint(path)
	if err != nil {
		return nil, err
	}

	// Additional Merkle verification if requested
	if verifyProofs && res.Integrity != nil {
		// Verify all leaves have valid proofs
		for i := 0; i < 5; i++ {
			proof, err := res.Integrity.Tree.GetProof(i)
			if err != nil {
				res.Warnings = append(res.Warnings, fmt.Sprintf("failed to generate proof for leaf %d: %v", i, err))
				continue
			}

			if !VerifyProofHex(proof, res.MerkleRoot) {
				res.Errors = append(res.Errors, fmt.Sprintf("merkle proof verification failed for leaf %d", i))
				res.Valid = false
			}
		}
	}

	return res, nil
}

// VerifyMerkleProof verifies a Merkle proof for a specific pack and leaf.
func VerifyMerkleProof(manifest *PackManifest, leafIndex int, proof *MerkleProof) (bool, error) {
	graphData, _ := json.Marshal(manifest.ExecutionGraph)
	integrity, err := ComputePackIntegrity(manifest, graphData)
	if err != nil {
		return false, fmt.Errorf("failed to compute integrity: %w", err)
	}

	// Regenerate proof at the same index to compare
	expectedProof, err := integrity.Tree.GetProof(leafIndex)
	if err != nil {
		return false, fmt.Errorf("failed to get expected proof: %w", err)
	}

	return VerifyProof(proof, expectedProof.LeafHash), nil
}

// GetContentAddress returns the content address (Merkle root) for a pack.
func GetContentAddress(manifest *PackManifest) (string, error) {
	graphData, _ := json.Marshal(manifest.ExecutionGraph)
	integrity, err := ComputePackIntegrity(manifest, graphData)
	if err != nil {
		return "", err
	}
	return integrity.MerkleRoot, nil
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
