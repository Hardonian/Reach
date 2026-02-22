package determinism

import (
	"testing"
)

func TestComputeStepKey(t *testing.T) {
	stepDef := map[string]interface{}{
		"name":        "test-step",
		"type":        "action",
		"action":      "read_file",
		"inputs":      map[string]string{"path": "/tmp/test"},
		"deterministic": true,
	}
	
	key1 := ComputeStepKey(stepDef, "1.2.3", "test-plugin", "0.1.0")
	key2 := ComputeStepKey(stepDef, "1.2.3", "test-plugin", "0.1.0")
	
	// Same definition should produce same key
	if key1.Hash != key2.Hash {
		t.Errorf("Step keys should match for identical definitions: %s != %s", key1.Hash, key2.Hash)
	}
	
	// Different engine version should produce different key
	key3 := ComputeStepKey(stepDef, "2.0.0", "test-plugin", "0.1.0")
	if key1.Hash == key3.Hash {
		t.Error("Step keys should differ for different engine versions")
	}
	
	// Different plugin version should produce different key
	key4 := ComputeStepKey(stepDef, "1.2.3", "test-plugin", "0.2.0")
	if key1.Hash == key4.Hash {
		t.Error("Step keys should differ for different plugin versions")
	}
}

func TestComputeStepKey_EphemeralFieldsIgnored(t *testing.T) {
	// Step definitions with ephemeral fields should produce same key
	stepDef1 := map[string]interface{}{
		"name":        "test-step",
		"type":        "action",
		"timestamp":   "2024-01-01T00:00:00Z",
		"id":          "step-123",
	}
	
	stepDef2 := map[string]interface{}{
		"name":        "test-step",
		"type":        "action",
		"timestamp":   "2024-06-15T12:30:00Z",
		"id":          "step-456",
	}
	
	key1 := ComputeStepKey(stepDef1, "1.0.0", "", "")
	key2 := ComputeStepKey(stepDef2, "1.0.0", "", "")
	
	if key1.Hash != key2.Hash {
		t.Error("Step keys should ignore ephemeral fields")
	}
}

func TestComputeStepKey_KeyOrderIndependence(t *testing.T) {
	// Different key order should produce same step key
	stepDef1 := map[string]interface{}{
		"name":   "test-step",
		"type":   "action",
		"inputs": map[string]string{"a": "1", "b": "2"},
	}
	
	stepDef2 := map[string]interface{}{
		"inputs": map[string]string{"b": "2", "a": "1"},
		"type":   "action",
		"name":   "test-step",
	}
	
	key1 := ComputeStepKey(stepDef1, "1.0.0", "", "")
	key2 := ComputeStepKey(stepDef2, "1.0.0", "", "")
	
	if key1.Hash != key2.Hash {
		t.Error("Step keys should be independent of map key order")
	}
}

func TestComputeProofHash(t *testing.T) {
	stepKey := StepKey{Hash: "abc123", Algorithm: "sha256"}
	contextFingerprint := "ctx-789"
	inputs := map[string]string{"key": "value"}
	outputs := map[string]string{"result": "success"}
	deps := []string{"dep1-proof", "dep2-proof"}
	
	proof1 := ComputeProofHash(stepKey, contextFingerprint, inputs, outputs, deps)
	proof2 := ComputeProofHash(stepKey, contextFingerprint, inputs, outputs, deps)
	
	// Same inputs should produce same proof
	if proof1.Hash != proof2.Hash {
		t.Error("Proof hashes should match for identical inputs")
	}
	
	// Different inputs should produce different proof
	proof3 := ComputeProofHash(stepKey, contextFingerprint, map[string]string{"key": "different"}, outputs, deps)
	if proof1.Hash == proof3.Hash {
		t.Error("Proof hashes should differ for different inputs")
	}
	
	// Different outputs should produce different proof
	proof4 := ComputeProofHash(stepKey, contextFingerprint, inputs, map[string]string{"result": "failure"}, deps)
	if proof1.Hash == proof4.Hash {
		t.Error("Proof hashes should differ for different outputs")
	}
	
	// Different dependencies should produce different proof
	proof5 := ComputeProofHash(stepKey, contextFingerprint, inputs, outputs, []string{"dep1-proof"})
	if proof1.Hash == proof5.Hash {
		t.Error("Proof hashes should differ for different dependencies")
	}
}

func TestComputeProofHash_DependencyOrderIndependence(t *testing.T) {
	stepKey := StepKey{Hash: "abc123", Algorithm: "sha256"}
	contextFingerprint := "ctx-789"
	inputs := map[string]string{"key": "value"}
	outputs := map[string]string{"result": "success"}
	
	// Dependency order should not matter
	deps1 := []string{"dep1", "dep2", "dep3"}
	deps2 := []string{"dep3", "dep1", "dep2"}
	
	proof1 := ComputeProofHash(stepKey, contextFingerprint, inputs, outputs, deps1)
	proof2 := ComputeProofHash(stepKey, contextFingerprint, inputs, outputs, deps2)
	
	if proof1.Hash != proof2.Hash {
		t.Error("Proof hashes should be independent of dependency order")
	}
}

func TestComputeRunProofHash(t *testing.T) {
	stepProofs := []ProofHash{
		{Hash: "proof1"},
		{Hash: "proof2"},
		{Hash: "proof3"},
	}
	
	hash1 := ComputeRunProofHash(stepProofs, "ctx-123", "1.0.0")
	hash2 := ComputeRunProofHash(stepProofs, "ctx-123", "1.0.0")
	
	if hash1 != hash2 {
		t.Error("Run proof hashes should match for identical inputs")
	}
	
	// Different order should produce different hash
	stepProofsReordered := []ProofHash{
		{Hash: "proof3"},
		{Hash: "proof1"},
		{Hash: "proof2"},
	}
	hash3 := ComputeRunProofHash(stepProofsReordered, "ctx-123", "1.0.0")
	if hash1 == hash3 {
		t.Error("Run proof hashes should differ for different step orders")
	}
}

func TestVerifyProofChain(t *testing.T) {
	// Create step key and compute proper proof hashes
	stepKey1 := ComputeStepKey(map[string]interface{}{"name": "step1"}, "1.0.0", "", "")
	stepKey2 := ComputeStepKey(map[string]interface{}{"name": "step2"}, "1.0.0", "", "")
	
	inputs1 := map[string]string{"input": "value1"}
	outputs1 := map[string]string{"output": "result1"}
	proof1 := ComputeProofHash(stepKey1, "ctx-123", inputs1, outputs1, []string{})
	
	inputs2 := map[string]string{"input": "value2"}
	outputs2 := map[string]string{"output": "result2"}
	// Include proof1 hash in dependency proofs
	proof2 := ComputeProofHash(stepKey2, "ctx-123", inputs2, outputs2, []string{proof1.Hash})
	
	// Create valid step chain
	step1 := StepRecord{
		StepID:      "step-1",
		Seq:         1,
		StepKey:     stepKey1,
		InputsHash:  proof1.InputsHash,
		OutputsHash: proof1.OutputsHash,
		ProofHash:   proof1,
		DependsOn:   []string{},
	}
	
	step2 := StepRecord{
		StepID:      "step-2",
		Seq:         2,
		StepKey:     stepKey2,
		InputsHash:  proof2.InputsHash,
		OutputsHash: proof2.OutputsHash,
		ProofHash:   proof2,
		DependsOn:   []string{"step-1"},
	}
	
	valid, issues := VerifyProofChain([]StepRecord{step1, step2})
	if !valid {
		t.Errorf("Expected valid chain, got issues: %v", issues)
	}
	
	// Test with missing dependency
	step3 := StepRecord{
		StepID:     "step-3",
		Seq:        3,
		StepKey:    StepKey{Hash: "key3"},
		InputsHash: Hash("input3"),
		OutputsHash: Hash("output3"),
		ProofHash:  ProofHash{Hash: "proof3", StepKeyHash: "key3", InputsHash: Hash("input3"), OutputsHash: Hash("output3")},
		DependsOn:  []string{"non-existent"},
	}
	
	valid, issues = VerifyProofChain([]StepRecord{step1, step2, step3})
	if valid {
		t.Error("Expected invalid chain due to missing dependency")
	}
	if len(issues) == 0 {
		t.Error("Expected issues for missing dependency")
	}
	
	// Test with missing dependency proof
	proof2NoDep := ComputeProofHash(stepKey2, "ctx-123", inputs2, outputs2, []string{})
	step2NoDep := StepRecord{
		StepID:      "step-2",
		Seq:         2,
		StepKey:     stepKey2,
		InputsHash:  proof2NoDep.InputsHash,
		OutputsHash: proof2NoDep.OutputsHash,
		ProofHash:   proof2NoDep,
		DependsOn:   []string{"step-1"},
	}
	
	valid, issues = VerifyProofChain([]StepRecord{step1, step2NoDep})
	if valid {
		t.Error("Expected invalid chain due to missing dependency proof")
	}
	if len(issues) == 0 {
		t.Error("Expected issues for missing dependency proof")
	}
}

func TestDiffStepLists(t *testing.T) {
	// Use proper computed hashes
	hash1 := Hash("step1-definition")
	hash2 := Hash("step2-definition")
	
	before := []StepRecord{
		{
			StepID:      "step-1",
			Seq:         1,
			StepKey:     StepKey{Hash: hash1},
			InputsHash:  Hash("input1"),
			OutputsHash: Hash("output1"),
			ProofHash:   ProofHash{Hash: Hash("proof1"), StepKeyHash: hash1},
			Status:      "success",
		},
		{
			StepID:      "step-2",
			Seq:         2,
			StepKey:     StepKey{Hash: hash2},
			InputsHash:  Hash("input2"),
			OutputsHash: Hash("output2"),
			ProofHash:   ProofHash{Hash: Hash("proof2"), StepKeyHash: hash2},
			Status:      "success",
		},
	}
	
	// Same steps
	diffs := DiffStepLists(before, before)
	if len(diffs) != 0 {
		t.Errorf("Expected no diffs for identical lists, got %d", len(diffs))
	}
	
	// Changed step
	after := []StepRecord{
		{
			StepID:      "step-1",
			Seq:         1,
			StepKey:     StepKey{Hash: hash1},
			InputsHash:  Hash("input1-changed"),
			OutputsHash: Hash("output1"),
			ProofHash:   ProofHash{Hash: Hash("proof1-changed"), StepKeyHash: hash1},
			Status:      "success",
		},
		{
			StepID:      "step-2",
			Seq:         2,
			StepKey:     StepKey{Hash: hash2},
			InputsHash:  Hash("input2"),
			OutputsHash: Hash("output2"),
			ProofHash:   ProofHash{Hash: Hash("proof2"), StepKeyHash: hash2},
			Status:      "success",
		},
	}
	
	diffs = DiffStepLists(before, after)
	if len(diffs) != 1 {
		t.Errorf("Expected 1 diff, got %d", len(diffs))
	}
	if !diffs[0].InputsChanged {
		t.Error("Expected inputs_changed to be true")
	}
	
	// Added step
	hash3 := Hash("step3-definition")
	after2 := []StepRecord{
		before[0],
		before[1],
		{
			StepID:      "step-3",
			Seq:         3,
			StepKey:     StepKey{Hash: hash3},
			InputsHash:  Hash("input3"),
			OutputsHash: Hash("output3"),
			ProofHash:   ProofHash{Hash: Hash("proof3"), StepKeyHash: hash3},
			Status:      "success",
		},
	}
	
	diffs = DiffStepLists(before, after2)
	foundAdded := false
	for _, d := range diffs {
		if d.StepID == "step-3" && d.Added {
			foundAdded = true
		}
	}
	if !foundAdded {
		t.Error("Expected to find added step-3")
	}
	
	// Removed step
	after3 := []StepRecord{before[0]}
	diffs = DiffStepLists(before, after3)
	foundRemoved := false
	for _, d := range diffs {
		if d.StepID == "step-2" && d.Removed {
			foundRemoved = true
		}
	}
	if !foundRemoved {
		t.Error("Expected to find removed step-2")
	}
}

func TestStepKey_String(t *testing.T) {
	key := StepKey{Hash: "abcdef1234567890"}
	str := key.String()
	if str != "abcdef1234567890" {
		t.Errorf("Expected 'abcdef1234567890', got '%s'", str)
	}
	
	// Long hash should be truncated
	key2 := StepKey{Hash: "abcdef1234567890abcdef1234567890"}
	str2 := key2.String()
	if str2 != "abcdef1234567890" {
		t.Errorf("Expected truncated hash, got '%s'", str2)
	}
}

func TestProofHash_String(t *testing.T) {
	proof := ProofHash{Hash: "abcdef1234567890"}
	str := proof.String()
	if str != "abcdef1234567890" {
		t.Errorf("Expected 'abcdef1234567890', got '%s'", str)
	}
}
