// Package harness provides registry PR validation for Reach.
package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// RegistryValidator validates packs for registry inclusion.
type RegistryValidator struct {
	Scorer      *Scorer
	Linter      *Linter
	MinScore    int
	RequireDocs bool
}

// ValidationResult contains the validation outcome.
type ValidationResult struct {
	PackID      string            `json:"pack_id"`
	Version     string            `json:"version"`
	Passed      bool              `json:"passed"`
	Checks      []CheckResult     `json:"checks"`
	ScoreReport *ScoreReport      `json:"score_report,omitempty"`
	Errors      []string          `json:"errors,omitempty"`
	Warnings    []string          `json:"warnings,omitempty"`
	Badges      []string          `json:"badges,omitempty"`
}

// CheckResult represents a single validation check.
type CheckResult struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message,omitempty"`
}

// NewRegistryValidator creates a new registry validator.
func NewRegistryValidator(fixturesDir string) *RegistryValidator {
	return &RegistryValidator{
		Scorer:      NewScorer(fixturesDir),
		Linter:      NewLinter(),
		MinScore:    60, // Bronze minimum
		RequireDocs: true,
	}
}

// ValidatePack performs full registry validation on a pack.
func (v *RegistryValidator) ValidatePack(packPath string) (*ValidationResult, error) {
	// Load pack
	packJSONPath := filepath.Join(packPath, "pack.json")
	packData, err := os.ReadFile(packJSONPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read pack.json: %w", err)
	}

	var pack PackDefinition
	if err := json.Unmarshal(packData, &pack); err != nil {
		return nil, fmt.Errorf("failed to parse pack.json: %w", err)
	}

	result := &ValidationResult{
		PackID:   pack.Metadata.ID,
		Version:  pack.Metadata.Version,
		Passed:   true,
		Checks:   []CheckResult{},
		Errors:   []string{},
		Warnings: []string{},
	}

	// Run all validation checks
	v.checkSchema(packPath, &pack, result)
	v.checkLint(packPath, result)
	v.checkDocs(packPath, result)
	v.checkPolicy(packPath, &pack, result)
	v.checkDeterminism(packPath, &pack, result)
	v.checkScoring(packPath, result)
	v.checkMetadata(&pack, result)

	// Determine overall pass/fail
	for _, check := range result.Checks {
		if !check.Passed {
			result.Passed = false
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %s", check.Name, check.Message))
		}
	}

	// Add badges from scoring
	if result.ScoreReport != nil {
		result.Badges = result.ScoreReport.Badges
	}

	return result, nil
}

// checkSchema validates the pack schema.
func (v *RegistryValidator) checkSchema(packPath string, pack *PackDefinition, result *ValidationResult) {
	check := CheckResult{Name: "Schema Validation", Passed: true}

	// Check required fields
	if pack.Metadata.ID == "" {
		check.Passed = false
		check.Message = "Missing pack ID"
	}
	if pack.Metadata.Version == "" {
		check.Passed = false
		check.Message = "Missing pack version"
	}
	if pack.Metadata.Name == "" {
		check.Passed = false
		check.Message = "Missing pack name"
	}
	if pack.Metadata.Author == "" {
		check.Passed = false
		check.Message = "Missing pack author"
	}
	if pack.Metadata.SpecVersion != "1.0" {
		check.Passed = false
		check.Message = fmt.Sprintf("Invalid spec_version: %s", pack.Metadata.SpecVersion)
	}

	result.Checks = append(result.Checks, check)
}

// checkLint runs the linter.
func (v *RegistryValidator) checkLint(packPath string, result *ValidationResult) {
	check := CheckResult{Name: "Lint Check", Passed: true}

	lintResult := v.Linter.LintPack(packPath)
	if !lintResult.Passed {
		check.Passed = false
		var issues []string
		for _, issue := range lintResult.Issues {
			if issue.Severity == "error" {
				issues = append(issues, fmt.Sprintf("%s: %s", issue.RuleID, issue.Message))
			}
		}
		check.Message = strings.Join(issues, "; ")
	}

	result.Checks = append(result.Checks, check)
}

// checkDocs validates documentation requirements.
func (v *RegistryValidator) checkDocs(packPath string, result *ValidationResult) {
	check := CheckResult{Name: "Documentation", Passed: true}

	// Check for README
	readmePath := filepath.Join(packPath, "README.md")
	if _, err := os.Stat(readmePath); os.IsNotExist(err) {
		if v.RequireDocs {
			check.Passed = false
			check.Message = "README.md required but not found"
		} else {
			result.Warnings = append(result.Warnings, "README.md not found (recommended)")
		}
	} else {
		// Check README has minimal content
		data, err := os.ReadFile(readmePath)
		if err != nil || len(data) < 100 {
			result.Warnings = append(result.Warnings, "README.md is very short")
		}
	}

	// Check for description in pack.json
	// (Already validated in schema check)

	result.Checks = append(result.Checks, check)
}

// checkPolicy validates policy requirements.
func (v *RegistryValidator) checkPolicy(packPath string, pack *PackDefinition, result *ValidationResult) {
	check := CheckResult{Name: "Policy Validation", Passed: true}

	// Check for high-risk permissions
	hasHighRisk := false
	for _, perm := range pack.DeclaredPermissions {
		if perm == "sys:admin" || perm == "sys:exec" {
			hasHighRisk = true
			break
		}
	}

	if hasHighRisk {
		// Packs with high-risk permissions need extra justification
		justificationPath := filepath.Join(packPath, "POLICY_JUSTIFICATION.md")
		if _, err := os.Stat(justificationPath); os.IsNotExist(err) {
			check.Passed = false
			check.Message = "High-risk permissions require POLICY_JUSTIFICATION.md"
		}
	}

	// Check policy contract exists for governed packs
	policyPath := filepath.Join(packPath, "policy.rego")
	if isGoverned(packPath) {
		if _, err := os.Stat(policyPath); os.IsNotExist(err) {
			check.Passed = false
			check.Message = "Governed pack requires policy.rego"
		}
	}

	result.Checks = append(result.Checks, check)
}

// checkDeterminism validates determinism requirements.
func (v *RegistryValidator) checkDeterminism(packPath string, pack *PackDefinition, result *ValidationResult) {
	check := CheckResult{Name: "Determinism Check", Passed: true}

	if !pack.DeterministicFlag {
		result.Warnings = append(result.Warnings, "Pack is not marked as deterministic")
	}

	// Additional determinism validation could go here
	// (e.g., scanning for non-deterministic patterns)

	result.Checks = append(result.Checks, check)
}

// checkScoring computes and validates scores.
func (v *RegistryValidator) checkScoring(packPath string, result *ValidationResult) {
	check := CheckResult{Name: "Quality Scoring", Passed: true}

	scoreReport, err := v.Scorer.ScorePack(packPath)
	if err != nil {
		check.Passed = false
		check.Message = fmt.Sprintf("Failed to compute scores: %v", err)
		result.Checks = append(result.Checks, check)
		return
	}

	result.ScoreReport = scoreReport

	// Check minimum overall score
	if int(scoreReport.Overall) < v.MinScore {
		check.Passed = false
		check.Message = fmt.Sprintf("Overall score %.1f below minimum %d", scoreReport.Overall, v.MinScore)
	}

	// Check individual category minimums
	minCategories := []struct {
		name  string
		score int
	}{
		{"Determinism", scoreReport.Scores.Determinism},
		{"Policy Hygiene", scoreReport.Scores.PolicyHygiene},
	}

	for _, cat := range minCategories {
		if cat.score < 50 {
			check.Passed = false
			check.Message = fmt.Sprintf("%s score %d below minimum 50", cat.name, cat.score)
		}
	}

	result.Checks = append(result.Checks, check)
}

// checkMetadata validates pack metadata quality.
func (v *RegistryValidator) checkMetadata(pack *PackDefinition, result *ValidationResult) {
	check := CheckResult{Name: "Metadata Quality", Passed: true}

	// Check description quality
	if len(pack.Metadata.Description) < 20 {
		result.Warnings = append(result.Warnings, "Description should be at least 20 characters")
	}

	// Check version format
	if !isValidVersion(pack.Metadata.Version) {
		check.Passed = false
		check.Message = fmt.Sprintf("Invalid version format: %s", pack.Metadata.Version)
	}

	// Check author is not placeholder
	if pack.Metadata.Author == "your-name" || pack.Metadata.Author == "author" {
		check.Passed = false
		check.Message = "Author field contains placeholder value"
	}

	result.Checks = append(result.Checks, check)
}

// isValidVersion checks if version follows semver.
func isValidVersion(version string) bool {
	// Simple semver check - production would use proper semver library
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return false
	}
	// Check each part is numeric
	for _, part := range parts {
		for _, c := range part {
			if c < '0' || c > '9' {
				return false
			}
		}
	}
	return true
}

// ToJSON serializes the result to JSON.
func (r *ValidationResult) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// ToHuman returns a human-readable validation report.
func (r *ValidationResult) ToHuman() string {
	var sb strings.Builder

	status := "✅ PASSED"
	if !r.Passed {
		status = "❌ FAILED"
	}

	sb.WriteString(fmt.Sprintf("Registry Validation: %s\n", status))
	sb.WriteString(fmt.Sprintf("Pack: %s@%s\n\n", r.PackID, r.Version))

	sb.WriteString("Checks:\n")
	for _, check := range r.Checks {
		symbol := "✅"
		if !check.Passed {
			symbol = "❌"
		}
		sb.WriteString(fmt.Sprintf("  %s %s\n", symbol, check.Name))
		if check.Message != "" {
			sb.WriteString(fmt.Sprintf("     %s\n", check.Message))
		}
	}

	if r.ScoreReport != nil {
		sb.WriteString(fmt.Sprintf("\nQuality Score: %.1f/100 (%s)\n", r.ScoreReport.Overall, r.ScoreReport.Grade))
	}

	if len(r.Warnings) > 0 {
		sb.WriteString("\nWarnings:\n")
		for _, warning := range r.Warnings {
			sb.WriteString(fmt.Sprintf("  ⚠️ %s\n", warning))
		}
	}

	if len(r.Errors) > 0 {
		sb.WriteString("\nErrors:\n")
		for _, err := range r.Errors {
			sb.WriteString(fmt.Sprintf("  ❌ %s\n", err))
		}
	}

	if len(r.Badges) > 0 {
		sb.WriteString("\nBadges:\n")
		for _, badge := range r.Badges {
			sb.WriteString(fmt.Sprintf("  %s\n", badge))
		}
	}

	return sb.String()
}

// ValidateRegistryPR validates multiple packs for a registry PR.
func (v *RegistryValidator) ValidateRegistryPR(registryDir string) ([]*ValidationResult, error) {
	packsDir := filepath.Join(registryDir, "packs")

	// List all packs
	entries, err := os.ReadDir(packsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read packs directory: %w", err)
	}

	var results []*ValidationResult
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Find version directories
		packDir := filepath.Join(packsDir, entry.Name())
		versions, err := os.ReadDir(packDir)
		if err != nil {
			continue
		}

		for _, version := range versions {
			if !version.IsDir() {
				continue
			}

			versionDir := filepath.Join(packDir, version.Name())
			result, err := v.ValidatePack(versionDir)
			if err != nil {
				results = append(results, &ValidationResult{
					PackID:   entry.Name(),
					Version:  version.Name(),
					Passed:   false,
					Errors:   []string{err.Error()},
				})
				continue
			}

			results = append(results, result)
		}
	}

	return results, nil
}