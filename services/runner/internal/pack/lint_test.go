package pack

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLint(t *testing.T) {
	// Create a temporary pack file
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "test.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:          "test-pack",
			Version:     "1.0.0",
			Name:        "Test Pack",
			Description: "A test pack for linting",
		},
		SpecVersion:         "1.0",
		DeclaredTools:       []string{"tool1", "tool2"},
		DeclaredPermissions: []string{"perm1", "perm2"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{
				{ID: "n1", Type: "Action"},
				{ID: "n2", Type: "Condition"},
			},
			Edges: []Edge{
				{From: "n1", To: "n2"},
			},
		},
		Deterministic: true,
	}

	data, _ := json.Marshal(manifest)
	if err := os.WriteFile(packPath, data, 0644); err != nil {
		t.Fatalf("failed to write test pack: %v", err)
	}

	// Run lint
	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint failed: %v", err)
	}

	if !result.Valid {
		t.Errorf("expected valid pack, got errors: %v", result.Errors)
	}

	if result.Metadata.ID != "test-pack" {
		t.Errorf("expected ID=test-pack, got: %s", result.Metadata.ID)
	}

	if result.Hash == "" {
		t.Error("expected non-empty hash")
	}

	// Merkle integration
	if result.MerkleRoot == "" {
		t.Error("expected non-empty MerkleRoot")
	}

	if result.Integrity == nil {
		t.Error("expected non-nil Integrity")
	}

	if result.MerkleProof == nil {
		t.Error("expected non-nil MerkleProof")
	}
}

func TestLintWithMerkle(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "test.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "merkle-test",
			Version: "1.0.0",
			Name:    "Merkle Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{"tool1"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
		Deterministic: true,
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	// Run lint with Merkle verification
	result, err := LintWithMerkle(packPath, true)
	if err != nil {
		t.Fatalf("lint with merkle failed: %v", err)
	}

	if !result.Valid {
		t.Errorf("expected valid pack, got errors: %v", result.Errors)
	}

	if result.MerkleRoot == "" {
		t.Error("expected MerkleRoot")
	}

	if result.Integrity == nil {
		t.Error("expected Integrity")
	}
}

func TestLint_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "invalid.pack.json")

	// Write invalid JSON
	os.WriteFile(packPath, []byte("{invalid json"), 0644)

	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint should not return error for invalid JSON: %v", err)
	}

	if result.Valid {
		t.Error("expected invalid result for bad JSON")
	}

	if len(result.Errors) == 0 {
		t.Error("expected errors for bad JSON")
	}
}

func TestLint_MissingSpecVersion(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "test.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "test",
			Version: "1.0.0",
		},
		// SpecVersion missing
		DeclaredTools: []string{},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{},
			Edges: []Edge{},
		},
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint failed: %v", err)
	}

	if result.Valid {
		t.Error("expected invalid result for missing specVersion")
	}

	hasSpecError := false
	for _, e := range result.Errors {
		if contains(e, "specVersion") {
			hasSpecError = true
			break
		}
	}
	if !hasSpecError {
		t.Error("expected error about missing specVersion")
	}
}

func TestLint_SystemPermissionWarning(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "test.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "test",
			Version: "1.0.0",
			Name:    "Test",
		},
		SpecVersion:         "1.0",
		DeclaredPermissions: []string{"sys:admin", "normal_perm"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint failed: %v", err)
	}

	hasSysWarning := false
	for _, w := range result.Warnings {
		if contains(w, "sys:") {
			hasSysWarning = true
			break
		}
	}
	if !hasSysWarning {
		t.Error("expected warning for sys: permission")
	}
}

func TestLint_CycleDetection(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "cycle.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "cycle-test",
			Version: "1.0.0",
			Name:    "Cycle Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{
				{ID: "n1", Type: "Action"},
				{ID: "n2", Type: "Action"},
				{ID: "n3", Type: "Action"},
			},
			Edges: []Edge{
				{From: "n1", To: "n2"},
				{From: "n2", To: "n3"},
				{From: "n3", To: "n1"}, // Creates cycle
			},
		},
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint failed: %v", err)
	}

	if result.Valid {
		t.Error("expected invalid result for cyclic graph")
	}

	hasCycleError := false
	for _, e := range result.Errors {
		if contains(e, "cycle") {
			hasCycleError = true
			break
		}
	}
	if !hasCycleError {
		t.Error("expected error about cycles")
	}
}

func TestLint_ToolNameTooLong(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "test.pack.json")

	longToolName := make([]byte, 200)
	for i := range longToolName {
		longToolName[i] = 'a'
	}

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "test",
			Version: "1.0.0",
			Name:    "Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{string(longToolName)},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	result, err := Lint(packPath)
	if err != nil {
		t.Fatalf("lint failed: %v", err)
	}

	if result.Valid {
		t.Error("expected invalid result for long tool name")
	}

	hasToolError := false
	for _, e := range result.Errors {
		if contains(e, "tool") && contains(e, "long") {
			hasToolError = true
			break
		}
	}
	if !hasToolError {
		t.Error("expected error about tool name length")
	}
}

func TestGetContentAddress(t *testing.T) {
	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "content-test",
			Version: "1.0.0",
			Name:    "Content Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{"tool1"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
		Deterministic: true,
	}

	addr, err := GetContentAddress(&manifest)
	if err != nil {
		t.Fatalf("get content address failed: %v", err)
	}

	if addr == "" {
		t.Error("expected non-empty content address")
	}

	// Same manifest should produce same address
	addr2, err := GetContentAddress(&manifest)
	if err != nil {
		t.Fatalf("get content address 2 failed: %v", err)
	}

	if addr != addr2 {
		t.Error("same manifest should produce same content address")
	}

	// Different manifest should produce different address
	manifest.Metadata.Version = "2.0.0"
	addr3, err := GetContentAddress(&manifest)
	if err != nil {
		t.Fatalf("get content address 3 failed: %v", err)
	}

	if addr == addr3 {
		t.Error("different manifest should produce different content address")
	}
}

func TestVerifyMerkleProof(t *testing.T) {
	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "proof-test",
			Version: "1.0.0",
			Name:    "Proof Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{"tool1"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
		Deterministic: true,
	}

	graphData, _ := json.Marshal(manifest.ExecutionGraph)
	integrity, _ := ComputePackIntegrity(&manifest, graphData)

	// Get proof for execution graph (leaf 3)
	proof, err := integrity.Tree.GetProof(3)
	if err != nil {
		t.Fatalf("get proof failed: %v", err)
	}

	// Verify proof
	valid, err := VerifyMerkleProof(&manifest, 3, proof)
	if err != nil {
		t.Fatalf("verify proof failed: %v", err)
	}

	if !valid {
		t.Error("expected proof to be valid")
	}
}

func TestLintResultConsistency(t *testing.T) {
	tmpDir := t.TempDir()
	packPath := filepath.Join(tmpDir, "consistent.pack.json")

	manifest := PackManifest{
		Metadata: Metadata{
			ID:      "consistent-test",
			Version: "1.0.0",
			Name:    "Consistency Test",
		},
		SpecVersion:   "1.0",
		DeclaredTools: []string{"tool1"},
		ExecutionGraph: ExecutionGraph{
			Nodes: []Node{{ID: "n1", Type: "Action"}},
			Edges: []Edge{},
		},
		Deterministic: true,
	}

	data, _ := json.Marshal(manifest)
	os.WriteFile(packPath, data, 0644)

	// Run lint multiple times
	result1, _ := Lint(packPath)
	result2, _ := Lint(packPath)

	// Hash should be consistent
	if result1.Hash != result2.Hash {
		t.Error("hash should be consistent across lint runs")
	}

	// Merkle root should be consistent
	if result1.MerkleRoot != result2.MerkleRoot {
		t.Error("MerkleRoot should be consistent across lint runs")
	}
}

// Helper function
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
