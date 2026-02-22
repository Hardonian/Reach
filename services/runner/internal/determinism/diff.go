package determinism

import (
	"fmt"
	"strings"
)

// DiffResult represents the structured diff between two runs.
type DiffResult struct {
	RunA          string      `json:"run_a"`
	RunB          string      `json:"run_b"`
	InputMatch    bool        `json:"input_match"`
	PolicyMatch   bool        `json:"policy_match"`
	ArtifactMatch bool        `json:"artifact_match"`
	OutputMatch   bool        `json:"output_match"`
	MetadataMatch bool        `json:"metadata_match"`
	Fields        []DiffField `json:"fields,omitempty"`
	MismatchFound bool        `json:"mismatch_found"`
}

// DiffField represents a specific field that differs between runs.
type DiffField struct {
	Path   string `json:"path"`
	ValA   any    `json:"val_a"`
	ValB   any    `json:"val_b"`
	Reason string `json:"reason,omitempty"`
}

// DiffRuns compares two run records and returns a structured diff.
func DiffRuns(runA, runB map[string]any) *DiffResult {
	res := &DiffResult{
		RunA: fmt.Sprint(runA["run_id"]),
		RunB: fmt.Sprint(runB["run_id"]),
	}

	res.InputMatch = Hash(runA["pack"]) == Hash(runB["pack"])
	res.PolicyMatch = Hash(runA["policy"]) == Hash(runB["policy"])
	res.ArtifactMatch = fmt.Sprint(runA["registry_snapshot_hash"]) == fmt.Sprint(runB["registry_snapshot_hash"])
	res.OutputMatch = Hash(runA["event_log"]) == Hash(runB["event_log"])
	res.MetadataMatch = Hash(runA["environment"]) == Hash(runB["environment"])

	if !res.InputMatch || !res.PolicyMatch || !res.ArtifactMatch || !res.OutputMatch || !res.MetadataMatch {
		res.MismatchFound = true
		// Simplified deep compare for interesting fields
		diffDeep(runA, runB, "", &res.Fields)
	}

	return res
}

func diffDeep(a, b any, path string, fields *[]DiffField) {
	if Hash(a) == Hash(b) {
		return
	}

	switch va := a.(type) {
	case map[string]any:
		vb, ok := b.(map[string]any)
		if !ok {
			*fields = append(*fields, DiffField{Path: path, ValA: a, ValB: b, Reason: "type mismatch"})
			return
		}
		// Check keys
		keys := make(map[string]bool)
		for k := range va {
			keys[k] = true
		}
		for k := range vb {
			keys[k] = true
		}

		for k := range keys {
			newPath := k
			if path != "" {
				newPath = path + "." + k
			}
			diffDeep(va[k], vb[k], newPath, fields)
		}

	case []any:
		vb, ok := b.([]any)
		if !ok {
			*fields = append(*fields, DiffField{Path: path, ValA: a, ValB: b, Reason: "type mismatch"})
			return
		}
		if len(va) != len(vb) {
			*fields = append(*fields, DiffField{Path: path, ValA: fmt.Sprintf("len=%d", len(va)), ValB: fmt.Sprintf("len=%d", len(vb)), Reason: "length mismatch"})
		}
		minLen := len(va)
		if len(vb) < minLen {
			minLen = len(vb)
		}
		for i := 0; i < minLen; i++ {
			diffDeep(va[i], vb[i], fmt.Sprintf("%s[%d]", path, i), fields)
		}

	default:
		if fmt.Sprint(a) != fmt.Sprint(b) {
			*fields = append(*fields, DiffField{Path: path, ValA: a, ValB: b})
		}
	}
}

// FormatDiff returns a human-readable string representation of the diff.
func (r *DiffResult) FormatDiff() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Diff between %s and %s:\n", r.RunA, r.RunB))
	if !r.MismatchFound {
		sb.WriteString("✓ Runs are identical.\n")
		return sb.String()
	}

	check := func(name string, match bool) {
		status := "✓"
		if !match {
			status = "✗"
		}
		sb.WriteString(fmt.Sprintf("%s %-10s\n", status, name))
	}

	check("Input", r.InputMatch)
	check("Policy", r.PolicyMatch)
	check("Artifacts", r.ArtifactMatch)
	check("Output", r.OutputMatch)
	check("Metadata", r.MetadataMatch)

	if len(r.Fields) > 0 {
		sb.WriteString("\nDetailed Field Mismatches:\n")
		for _, f := range r.Fields {
			sb.WriteString(fmt.Sprintf("  %s:\n", f.Path))
			sb.WriteString(fmt.Sprintf("    A: %v\n", f.ValA))
			sb.WriteString(fmt.Sprintf("    B: %v\n", f.ValB))
			if f.Reason != "" {
				sb.WriteString(fmt.Sprintf("    Reason: %s\n", f.Reason))
			}
		}
	}

	return sb.String()
}
