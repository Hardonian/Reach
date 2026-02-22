// Package determinism provides deterministic hashing and serialization utilities
// for the Reach execution engine.
package determinism

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// StepKey represents a stable identifier for a step definition.
// It is computed from the canonical step definition and remains
// consistent across reruns, machines, and executions.
type StepKey struct {
	Hash        string `json:"hash"`
	EngineVer   string `json:"engine_version"`
	PluginVer   string `json:"plugin_version,omitempty"`
	Algorithm   string `json:"algorithm"`
}

// ProofHash represents a cryptographic proof of step execution.
// It binds the step execution to its inputs, outputs, and dependencies.
type ProofHash struct {
	Hash              string   `json:"hash"`
	StepKeyHash       string   `json:"step_key_hash"`
	InputsHash        string   `json:"inputs_hash"`
	OutputsHash       string   `json:"outputs_hash"`
	DependencyProofs  []string `json:"dependency_proofs,omitempty"`
	ContextFingerprint string  `json:"context_fingerprint"`
	Algorithm         string   `json:"algorithm"`
}

// StepRecord represents a recorded step with all evidence.
type StepRecord struct {
	StepID          string            `json:"step_id"`
	StepKey         StepKey           `json:"step_key"`
	Seq             int               `json:"seq"`
	Name            string            `json:"name"`
	Status          string            `json:"status"`
	InputsHash      string            `json:"inputs_hash"`
	OutputsHash     string            `json:"outputs_hash"`
	ProofHash       ProofHash         `json:"proof_hash"`
	DependsOn       []string          `json:"depends_on,omitempty"`
	Plugin          string            `json:"plugin,omitempty"`
	Errors          []string          `json:"errors,omitempty"`
	StartedAt       string            `json:"started_at,omitempty"`
	CompletedAt     string            `json:"completed_at,omitempty"`
	DurationMs      int64             `json:"duration_ms,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// ComputeStepKey computes a stable step key from the step definition.
// The key is deterministic across runs and machines.
func ComputeStepKey(stepDef map[string]interface{}, engineVersion string, pluginName string, pluginVersion string) StepKey {
	// Create canonical representation
	canonical := canonicalizeStepDef(stepDef)
	
	// Add versioning info
	hashInput := map[string]interface{}{
		"step_definition": canonical,
		"engine_version_major": extractMajorVersion(engineVersion),
		"plugin_name": pluginName,
		"plugin_version": pluginVersion,
	}
	
	hash := Hash(hashInput)
	
	return StepKey{
		Hash:      hash,
		EngineVer: extractMajorVersion(engineVersion),
		PluginVer: pluginVersion,
		Algorithm: "sha256",
	}
}

// ComputeProofHash computes a proof hash for a step execution.
// This binds the step to its specific execution context.
func ComputeProofHash(stepKey StepKey, contextFingerprint string, inputs interface{}, outputs interface{}, dependencyProofs []string) ProofHash {
	// Hash inputs and outputs
	inputsHash := Hash(inputs)
	outputsHash := Hash(outputs)
	
	// Sort dependency proofs for determinism
	sortedDeps := make([]string, len(dependencyProofs))
	copy(sortedDeps, dependencyProofs)
	sort.Strings(sortedDeps)
	
	// Compute combined hash
	hashInput := map[string]interface{}{
		"step_key_hash":       stepKey.Hash,
		"context_fingerprint": contextFingerprint,
		"inputs_hash":         inputsHash,
		"outputs_hash":        outputsHash,
		"dependency_proofs":   sortedDeps,
	}
	
	hash := Hash(hashInput)
	
	return ProofHash{
		Hash:               hash,
		StepKeyHash:        stepKey.Hash,
		InputsHash:         inputsHash,
		OutputsHash:        outputsHash,
		DependencyProofs:   sortedDeps,
		ContextFingerprint: contextFingerprint,
		Algorithm:          "sha256",
	}
}

// ComputeRunProofHash computes the overall proof hash for a run.
// This is the root of the proof chain.
func ComputeRunProofHash(stepProofs []ProofHash, contextFingerprint string, engineVersion string) string {
	// Extract proof hashes in order
	proofHashes := make([]string, len(stepProofs))
	for i, p := range stepProofs {
		proofHashes[i] = p.Hash
	}
	
	hashInput := map[string]interface{}{
		"step_proof_hashes":   proofHashes,
		"context_fingerprint": contextFingerprint,
		"engine_version_major": extractMajorVersion(engineVersion),
	}
	
	return Hash(hashInput)
}

// VerifyProofChain verifies that a sequence of proofs forms a valid chain.
// Returns true if all proofs are valid and dependencies are satisfied.
// Note: Full proof verification requires original inputs/outputs; this checks
// structural integrity and dependency relationships.
func VerifyProofChain(steps []StepRecord) (bool, []string) {
	var issues []string
	proofMap := make(map[string]ProofHash)
	stepMap := make(map[string]StepRecord)
	
	// Build maps
	for _, step := range steps {
		proofMap[step.StepID] = step.ProofHash
		stepMap[step.StepID] = step
	}
	
	// Verify each step
	for i, step := range steps {
		// Verify the proof hash references the correct step key
		if step.ProofHash.StepKeyHash != step.StepKey.Hash {
			issues = append(issues, fmt.Sprintf("step %d (%s): step key hash mismatch in proof", i, step.StepID))
		}
		
		// Verify the proof hash references the correct inputs/outputs
		if step.ProofHash.InputsHash != step.InputsHash {
			issues = append(issues, fmt.Sprintf("step %d (%s): inputs hash mismatch in proof", i, step.StepID))
		}
		if step.ProofHash.OutputsHash != step.OutputsHash {
			issues = append(issues, fmt.Sprintf("step %d (%s): outputs hash mismatch in proof", i, step.StepID))
		}
		
		// Verify dependencies exist and their proofs are included
		for _, depID := range step.DependsOn {
			if depStep, ok := stepMap[depID]; !ok {
				issues = append(issues, fmt.Sprintf("step %d (%s): missing dependency %s", i, step.StepID, depID))
			} else {
				// Check that dependency proof is referenced
				depProofFound := false
				for _, depProof := range step.ProofHash.DependencyProofs {
					if depProof == depStep.ProofHash.Hash {
						depProofFound = true
						break
					}
				}
				if !depProofFound {
					issues = append(issues, fmt.Sprintf("step %d (%s): dependency proof for %s not found", i, step.StepID, depID))
				}
			}
		}
	}
	
	return len(issues) == 0, issues
}

// canonicalizeStepDef creates a canonical form of a step definition.
// Removes ephemeral fields and sorts keys.
func canonicalizeStepDef(stepDef map[string]interface{}) map[string]interface{} {
	// Fields to exclude from canonicalization
	ephemeralFields := map[string]bool{
		"id":          true,
		"timestamp":   true,
		"started_at":  true,
		"completed_at": true,
		"duration_ms": true,
		"run_id":      true,
		"execution_id": true,
	}
	
	result := make(map[string]interface{})
	
	// Sort keys for determinism
	keys := make([]string, 0, len(stepDef))
	for k := range stepDef {
		if !ephemeralFields[k] {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	
	// Copy fields in sorted order
	for _, k := range keys {
		result[k] = canonicalize(stepDef[k])
	}
	
	return result
}

// extractMajorVersion extracts the major version from a version string.
func extractMajorVersion(version string) string {
	parts := strings.Split(version, ".")
	if len(parts) > 0 {
		return parts[0]
	}
	return version
}

// hashPlaceholder creates a placeholder for hash verification.
func hashPlaceholder(hash string) interface{} {
	return map[string]string{"_hash": hash}
}

// StepDiff represents the difference between two steps.
type StepDiff struct {
	StepID       string            `json:"step_id"`
	Changed      bool              `json:"changed"`
	Added        bool              `json:"added"`
	Removed      bool              `json:"removed"`
	KeyChanged   bool              `json:"key_changed"`
	ProofChanged bool              `json:"proof_changed"`
	InputsChanged bool             `json:"inputs_changed"`
	OutputsChanged bool            `json:"outputs_changed"`
	Before       *StepRecord       `json:"before,omitempty"`
	After        *StepRecord       `json:"after,omitempty"`
	Differences  map[string]string `json:"differences,omitempty"`
}

// DiffStepLists compares two lists of steps and returns the differences.
func DiffStepLists(before, after []StepRecord) []StepDiff {
	var diffs []StepDiff
	
	beforeMap := make(map[string]StepRecord)
	for _, s := range before {
		beforeMap[s.StepID] = s
	}
	
	afterMap := make(map[string]StepRecord)
	for _, s := range after {
		afterMap[s.StepID] = s
	}
	
	// Find changed and added steps
	for id, afterStep := range afterMap {
		if beforeStep, ok := beforeMap[id]; ok {
			// Step exists in both - check for changes
			diff := compareSteps(beforeStep, afterStep)
			if diff.Changed {
				diffs = append(diffs, diff)
			}
		} else {
			// Step is new
			diffs = append(diffs, StepDiff{
				StepID:  id,
				Changed: true,
				Added:   true,
				After:   &afterStep,
			})
		}
	}
	
	// Find removed steps
	for id, beforeStep := range beforeMap {
		if _, ok := afterMap[id]; !ok {
			diffs = append(diffs, StepDiff{
				StepID:  id,
				Changed: true,
				Removed: true,
				Before:  &beforeStep,
			})
		}
	}
	
	// Sort diffs by step sequence
	sort.Slice(diffs, func(i, j int) bool {
		return diffs[i].StepID < diffs[j].StepID
	})
	
	return diffs
}

// compareSteps compares two step records and returns the differences.
func compareSteps(before, after StepRecord) StepDiff {
	diff := StepDiff{
		StepID:  before.StepID,
		Before:  &before,
		After:   &after,
		Differences: make(map[string]string),
	}
	
	if before.StepKey.Hash != after.StepKey.Hash {
		diff.KeyChanged = true
		diff.Changed = true
		diff.Differences["step_key"] = fmt.Sprintf("%s -> %s", before.StepKey.ShortHash(), after.StepKey.ShortHash())
	}
	
	if before.ProofHash.Hash != after.ProofHash.Hash {
		diff.ProofChanged = true
		diff.Changed = true
		diff.Differences["proof_hash"] = fmt.Sprintf("%s -> %s", before.ProofHash.ShortHash(), after.ProofHash.ShortHash())
	}
	
	if before.InputsHash != after.InputsHash {
		diff.InputsChanged = true
		diff.Changed = true
		diff.Differences["inputs"] = "changed"
	}
	
	if before.OutputsHash != after.OutputsHash {
		diff.OutputsChanged = true
		diff.Changed = true
		diff.Differences["outputs"] = "changed"
	}
	
	if before.Status != after.Status {
		diff.Changed = true
		diff.Differences["status"] = fmt.Sprintf("%s -> %s", before.Status, after.Status)
	}
	
	return diff
}

// String returns a human-readable representation of a StepKey.
func (sk StepKey) String() string {
	if len(sk.Hash) > 16 {
		return sk.Hash[:16]
	}
	return sk.Hash
}

// ShortHash returns a short prefix of the hash for display.
func (sk StepKey) ShortHash() string {
	if len(sk.Hash) > 8 {
		return sk.Hash[:8]
	}
	return sk.Hash
}

// String returns a human-readable representation of a ProofHash.
func (ph ProofHash) String() string {
	if len(ph.Hash) > 16 {
		return ph.Hash[:16]
	}
	return ph.Hash
}

// ShortHash returns a short prefix of the hash for display.
func (ph ProofHash) ShortHash() string {
	if len(ph.Hash) > 8 {
		return ph.Hash[:8]
	}
	return ph.Hash
}

// SerializeStepRecord serializes a step record to JSON.
func SerializeStepRecord(step StepRecord) ([]byte, error) {
	return json.MarshalIndent(step, "", "  ")
}

// DeserializeStepRecord deserializes a step record from JSON.
func DeserializeStepRecord(data []byte) (StepRecord, error) {
	var step StepRecord
	err := json.Unmarshal(data, &step)
	return step, err
}

// ComputeHash computes a SHA256 hash of the given data.
func ComputeHash(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
