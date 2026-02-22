// Package proof provides proof transparency features including:
// - proof explain: detailed explanation of proof components
// - proof diff-hash: comparing proof hashes between runs
// - debug canonical: debugging canonical JSON serialization
package stress

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"time"
)

// ProofExplain provides detailed explanation of proof components for a run.
type ProofExplain struct {
	RunID           string              `json:"run_id"`
	StepIndex       int                 `json:"step_index,omitempty"`
	CanonicalInput  string              `json:"canonical_input_preview"`
	DependencyChain []ProofComponent    `json:"dependency_proof_chain"`
	Provenance      []ProvenanceElement `json:"provenance_elements"`
	MetadataExcluded []string           `json:"metadata_excluded"`
	HashComponents  HashBreakdown       `json:"hash_components"`
}

// ProofComponent represents a single component in the proof chain.
type ProofComponent struct {
	ComponentID   string `json:"component_id"`
	ComponentType string `json:"component_type"`
	Hash          string `json:"hash"`
	DependsOn     []string `json:"depends_on,omitempty"`
}

// ProvenanceElement represents a provenance element in the proof.
type ProvenanceElement struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Value       string `json:"value"`
	Timestamp   string `json:"timestamp"`
}

// HashBreakdown shows the hash components breakdown.
type HashBreakdown struct {
	InputHash      string `json:"input_hash"`
	PolicyHash     string `json:"policy_hash"`
	ArtifactsHash  string `json:"artifacts_hash"`
	ExecutionHash  string `json:"execution_hash"`
	OutputHash     string `json:"output_hash"`
	FinalProofHash string `json:"final_proof_hash"`
}

// ProofDiff represents the difference between two proof hashes.
type ProofDiff struct {
	RunA           string            `json:"run_a"`
	RunB           string            `json:"run_b"`
	ChangedComponents []ChangedComponent `json:"changed_components"`
	InputFieldsResponsible []FieldResponsibility `json:"input_fields_responsible"`
}

// ChangedComponent represents a component that changed between runs.
type ChangedComponent struct {
	Component     string `json:"component"`
	HashA         string `json:"hash_a"`
	HashB         string `json:"hash_b"`
	DiffPercentage float64 `json:"diff_percentage"`
}

// FieldResponsibility shows which input fields caused the proof change.
type FieldResponsibility struct {
	Field      string  `json:"field"`
	ChangeType string  `json:"change_type"`
	Impact     float64 `json:"impact_score"`
}

// CanonicalDebug shows the result of canonical JSON debugging.
type CanonicalDebug struct {
	InputFile    string              `json:"input_file"`
	SortedKeys   []string            `json:"sorted_keys"`
	FloatNormalization map[string]string `json:"float_normalization"`
	UndefinedRemoved []string         `json:"undefined_removed"`
	FinalCanonical string            `json:"final_canonical_string"`
	Hash         string              `json:"canonical_hash"`
}

// TransparentProof stores expanded proof component map for inspection.
type TransparentProof struct {
	RunID         string                 `json:"run_id"`
	Timestamp     string                 `json:"timestamp"`
	Components    map[string]any         `json:"components"`
	ExpandedMap   map[string]any         `json:"expanded_proof_map"`
	// Note: proofHash calculation remains unchanged when transparent mode is enabled
	OriginalProofHash string            `json:"original_proof_hash"`
}

// ExplainProof provides detailed explanation of a proof for a run.
func ExplainProof(runID string, eventLog []map[string]any, runRecord any, stepIndex int) (*ProofExplain, error) {
	explain := &ProofExplain{
		RunID:      runID,
		StepIndex:  stepIndex,
		MetadataExcluded: []string{},
	}

	// Get canonical input preview
	if stepIndex >= 0 && stepIndex < len(eventLog) {
		explain.CanonicalInput = getCanonicalPreview(eventLog[stepIndex])
	} else {
		explain.CanonicalInput = getCanonicalPreview(eventLog)
	}

	// Build dependency proof chain
	explain.DependencyChain = buildDependencyChain(eventLog, stepIndex)

	// Gather provenance elements
	explain.Provenance = gatherProvenance(runRecord)

	// Build hash breakdown
	explain.HashComponents = buildHashBreakdown(eventLog, runRecord)

	return explain, nil
}

func getCanonicalPreview(data any) string {
	// Canonicalize the data
	canon := canonicalizeForProof(data)
	b, _ := json.Marshal(canon)
	return string(b)
}

func buildDependencyChain(eventLog []map[string]any, stepIndex int) []ProofComponent {
	chain := []ProofComponent{}
	
	if stepIndex >= 0 && stepIndex < len(eventLog) {
		// Single step
		event := eventLog[stepIndex]
		chain = append(chain, ProofComponent{
			ComponentID:   fmt.Sprintf("step-%d", stepIndex),
			ComponentType: "execution_step",
			Hash:         computeHash(event),
			DependsOn:     []string{},
		})
		
		// Add dependencies from previous steps
		if stepIndex > 0 {
			chain[0].DependsOn = append(chain[0].DependsOn, fmt.Sprintf("step-%d", stepIndex-1))
		}
	} else {
		// Full chain
		for i, event := range eventLog {
			comp := ProofComponent{
				ComponentID:   fmt.Sprintf("step-%d", i),
				ComponentType: "execution_step",
				Hash:         computeHash(event),
			}
			if i > 0 {
				comp.DependsOn = append(comp.DependsOn, fmt.Sprintf("step-%d", i-1))
			}
			chain = append(chain, comp)
		}
	}
	
	return chain
}

func gatherProvenance(runRecord any) []ProvenanceElement {
	provenance := []ProvenanceElement{
		{
			Type:      "engine",
			Source:    "reach-core",
			Value:     "1.0.0",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		{
			Type:      "determinism",
			Source:    "canonical-json",
			Value:     "enabled",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}
	return provenance
}

func buildHashBreakdown(eventLog []map[string]any, runRecord any) HashBreakdown {
	inputData := map[string]any{"events": eventLog}
	
	return HashBreakdown{
		InputHash:      computeHash(inputData),
		PolicyHash:     computeHash(map[string]any{"policy": "default"}),
		ArtifactsHash:  computeHash(map[string]any{"artifacts": []string{}}),
		ExecutionHash: computeHash(eventLog),
		OutputHash:    computeHash(map[string]any{"output": "complete"}),
		FinalProofHash: computeHash(map[string]any{
			"input":     computeHash(inputData),
			"policy":    computeHash(map[string]any{"policy": "default"}),
			"artifacts": computeHash(map[string]any{"artifacts": []string{}}),
			"execution": computeHash(eventLog),
		}),
	}
}

func computeHash(data any) string {
	canon := canonicalizeForProof(data)
	b, _ := json.Marshal(canon)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// DiffHash compares proof hashes between two runs and identifies what changed.
func DiffHash(runAID string, eventLogA []map[string]any, runBID string, eventLogB []map[string]any) (*ProofDiff, error) {
	diff := &ProofDiff{
		RunA:     runAID,
		RunB:     runBID,
		ChangedComponents: []ChangedComponent{},
		InputFieldsResponsible: []FieldResponsibility{},
	}

	// Compare overall proof hashes
	hashA := computeHash(eventLogA)
	hashB := computeHash(eventLogB)

	if hashA != hashB {
		// Find what changed
		diff.ChangedComponents = append(diff.ChangedComponents, ChangedComponent{
			Component:     "event_log",
			HashA:         hashA[:16],
			HashB:         hashB[:16],
			DiffPercentage: computeDiffPercentage(hashA, hashB),
		})
	}

	// Analyze input field responsibilities
	diff.InputFieldsResponsible = analyzeFieldResponsibility(eventLogA, eventLogB)

	return diff, nil
}

func computeDiffPercentage(hashA, hashB string) float64 {
	differing := 0
	for i := 0; i < len(hashA) && i < len(hashB); i++ {
		if hashA[i] != hashB[i] {
			differing++
		}
	}
	return float64(differing) / float64(len(hashA)) * 100
}

func analyzeFieldResponsibility(logA, logB []map[string]any) []FieldResponsibility {
	fields := []FieldResponsibility{}
	
	// Collect all unique fields from both logs
	fieldChanges := make(map[string]bool)
	
	for _, eventA := range logA {
		for key := range eventA {
			fieldChanges[key] = true
		}
	}
	
	for _, eventB := range logB {
		for key := range eventB {
			fieldChanges[key] = true
		}
	}
	
	// Analyze each field
	for field := range fieldChanges {
		// Find value in log A
		var valA any
		for _, event := range logA {
			if v, ok := event[field]; ok {
				valA = v
				break
			}
		}
		
		// Find value in log B
		var valB any
		for _, event := range logB {
			if v, ok := event[field]; ok {
				valB = v
				break
			}
		}
		
		// Check if they differ
		if !reflect.DeepEqual(valA, valB) {
			impact := 50.0 // Default impact
			lowerField := strings.ToLower(field)
			if strings.Contains(lowerField, "timestamp") || strings.Contains(lowerField, "time") {
				impact = 100.0
			}
			fields = append(fields, FieldResponsibility{
				Field:      field,
				ChangeType: "value_modified",
				Impact:     impact,
			})
		}
	}
	
	return fields
}

// DebugCanonical shows the canonical form of a JSON file for debugging.
func DebugCanonical(jsonFilePath string) (*CanonicalDebug, error) {
	debug := &CanonicalDebug{
		InputFile:         jsonFilePath,
		SortedKeys:        []string{},
		FloatNormalization: make(map[string]string),
		UndefinedRemoved:  []string{},
	}

	// Read and parse the JSON file
	data, err := os.ReadFile(jsonFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var parsed any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Canonicalize and collect debug info
	canon := canonicalizeForProof(parsed)
	debug.SortedKeys = collectSortedKeys(canon)
	debug.FloatNormalization = collectFloatNormalization(canon, "")
	canonicalBytes, _ := json.Marshal(canon)
	debug.FinalCanonical = string(canonicalBytes)
	debug.Hash = computeHash(canon)

	return debug, nil
}

func collectSortedKeys(data any, prefix ...string) []string {
	keys := []string{}
	
	switch v := data.(type) {
	case map[string]any:
		for k := range v {
			fullKey := k
			if len(prefix) > 0 {
				fullKey = prefix[0] + "." + k
			}
			keys = append(keys, fullKey)
			keys = append(keys, collectSortedKeys(v[k], fullKey)...)
		}
		sort.Strings(keys)
	case []any:
		for i, item := range v {
			keys = append(keys, collectSortedKeys(item, fmt.Sprintf("[%d]", i))...)
		}
	}
	
	return keys
}

func collectFloatNormalization(data any, path string) map[string]string {
	result := make(map[string]string)
	
	var walk func(v any, p string)
	walk = func(v any, p string) {
		switch vv := v.(type) {
		case float64:
			// Check for floating point that might need normalization
			if vv != float64(int64(vv)) {
				result[p] = fmt.Sprintf("%.10f", vv)
			}
		case map[string]any:
			for k, val := range vv {
				newPath := p
				if newPath == "" {
					newPath = k
				} else {
					newPath += "." + k
				}
				walk(val, newPath)
			}
		case []any:
			for i, val := range vv {
				walk(val, fmt.Sprintf("%s[%d]", p, i))
			}
		}
	}
	
	walk(data, path)
	return result
}

// TransparentMode enables transparent proof mode where expanded proof component
// map is stored for inspection but does not alter proofHash calculation.
type TransparentMode struct {
	Enabled bool
}

// EnableTransparentMode enables transparent mode for a run.
func EnableTransparentMode(runID string, eventLog []map[string]any) *TransparentProof {
	// Compute original proof hash (unchanged)
	originalHash := computeHash(eventLog)

	// Build expanded proof map for inspection
	expandedMap := buildExpandedProofMap(eventLog)

	return &TransparentProof{
		RunID:           runID,
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
		Components:      map[string]any{"events": len(eventLog)},
		ExpandedMap:     expandedMap,
		OriginalProofHash: originalHash,
	}
}

func buildExpandedProofMap(eventLog []map[string]any) map[string]any {
	expanded := make(map[string]any)
	
	for i, event := range eventLog {
		stepKey := fmt.Sprintf("step_%d", i)
		expanded[stepKey] = map[string]any{
			"index":    i,
			"hash":     computeHash(event),
			"type":     getEventType(event),
			"expanded":  event,
		}
	}
	
	return expanded
}

func getEventType(event map[string]any) string {
	if t, ok := event["type"].(string); ok {
		return t
	}
	if a, ok := event["action"].(string); ok {
		return a
	}
	return "unknown"
}

// canonicalizeForProof creates a canonical form suitable for proof computation.
func canonicalizeForProof(v any) any {
	switch vv := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(vv))
		for k := range vv {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		res := make(map[string]any, len(keys))
		for _, k := range keys {
			res[k] = canonicalizeForProof(vv[k])
		}
		return res
	case []any:
		res := make([]any, len(vv))
		for i := range vv {
			res[i] = canonicalizeForProof(vv[i])
		}
		return res
	default:
		return vv
	}
}

// WriteProofReport writes a proof explanation report to a writer.
func WriteProofReport(w io.Writer, explain *ProofExplain) error {
	fmt.Fprintf(w, "Proof Explanation for Run: %s\n", explain.RunID)
	if explain.StepIndex >= 0 {
		fmt.Fprintf(w, "Step Index: %d\n", explain.StepIndex)
	}
	fmt.Fprintf(w, "\n")

	fmt.Fprintf(w, "=== Canonical Input Preview ===\n")
	fmt.Fprintf(w, "%s\n\n", explain.CanonicalInput)

	fmt.Fprintf(w, "=== Dependency Proof Chain ===\n")
	for _, comp := range explain.DependencyChain {
		fmt.Fprintf(w, "Component: %s (type: %s)\n", comp.ComponentID, comp.ComponentType)
		fmt.Fprintf(w, "  Hash: %s\n", comp.Hash[:16]+"...")
		if len(comp.DependsOn) > 0 {
			fmt.Fprintf(w, "  Depends on: %v\n", comp.DependsOn)
		}
	}
	fmt.Fprintf(w, "\n")

	fmt.Fprintf(w, "=== Provenance Elements ===\n")
	for _, prov := range explain.Provenance {
		fmt.Fprintf(w, "- %s: %s (source: %s)\n", prov.Type, prov.Value, prov.Source)
	}
	fmt.Fprintf(w, "\n")

	fmt.Fprintf(w, "=== Hash Components Breakdown ===\n")
	fmt.Fprintf(w, "Input Hash:      %s\n", explain.HashComponents.InputHash[:16]+"...")
	fmt.Fprintf(w, "Policy Hash:     %s\n", explain.HashComponents.PolicyHash[:16]+"...")
	fmt.Fprintf(w, "Artifacts Hash:  %s\n", explain.HashComponents.ArtifactsHash[:16]+"...")
	fmt.Fprintf(w, "Execution Hash: %s\n", explain.HashComponents.ExecutionHash[:16]+"...")
	fmt.Fprintf(w, "Output Hash:     %s\n", explain.HashComponents.OutputHash[:16]+"...")
	fmt.Fprintf(w, "Final Proof:    %s\n", explain.HashComponents.FinalProofHash[:16]+"...")

	if len(explain.MetadataExcluded) > 0 {
		fmt.Fprintf(w, "\n=== Metadata Excluded ===\n")
		for _, m := range explain.MetadataExcluded {
			fmt.Fprintf(w, "- %s\n", m)
		}
	}

	return nil
}

// SaveTransparentProof saves the transparent proof to a file.
func SaveTransparentProof(tp *TransparentProof, outputPath string) error {
	// Ensure directory exists
	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	
	// Write the proof
	data, _ := json.MarshalIndent(tp, "", "  ")
	return os.WriteFile(outputPath, data, 0644)
}

// LoadTransparentProof loads a transparent proof from a file.
func LoadTransparentProof(inputPath string) (*TransparentProof, error) {
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return nil, err
	}
	
	var tp TransparentProof
	if err := json.Unmarshal(data, &tp); err != nil {
		return nil, err
	}
	
	return &tp, nil
}

// WriteReport writes a proof explanation report to a writer.
func WriteReport(w io.Writer, explain *ProofExplain) error {
	fmt.Fprintf(w, "Proof Explanation for Run: %s\n", explain.RunID)
	if explain.StepIndex >= 0 {
		fmt.Fprintf(w, "Step Index: %d\n", explain.StepIndex)
	}
	fmt.Fprintf(w, "\n")
	
	fmt.Fprintf(w, "=== Canonical Input Preview ===\n")
	fmt.Fprintf(w, "%s\n\n", explain.CanonicalInput)
	
	fmt.Fprintf(w, "=== Dependency Proof Chain ===\n")
	for _, comp := range explain.DependencyChain {
		fmt.Fprintf(w, "Component: %s (type: %s)\n", comp.ComponentID, comp.ComponentType)
		fmt.Fprintf(w, "  Hash: %s\n", comp.Hash[:16]+"...")
		if len(comp.DependsOn) > 0 {
			fmt.Fprintf(w, "  Depends on: %v\n", comp.DependsOn)
		}
	}
	fmt.Fprintf(w, "\n")
	
	fmt.Fprintf(w, "=== Hash Components Breakdown ===\n")
	fmt.Fprintf(w, "Input Hash:      %s\n", explain.HashComponents.InputHash[:16]+"...")
	fmt.Fprintf(w, "Policy Hash:     %s\n", explain.HashComponents.PolicyHash[:16]+"...")
	fmt.Fprintf(w, "Artifacts Hash:  %s\n", explain.HashComponents.ArtifactsHash[:16]+"...")
	fmt.Fprintf(w, "Execution Hash: %s\n", explain.HashComponents.ExecutionHash[:16]+"...")
	fmt.Fprintf(w, "Output Hash:     %s\n", explain.HashComponents.OutputHash[:16]+"...")
	fmt.Fprintf(w, "Final Proof:    %s\n", explain.HashComponents.FinalProofHash[:16]+"...")
	
	return nil
}
