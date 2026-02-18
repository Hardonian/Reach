// Package harness provides pack health checking capabilities.
package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DoctorCheck represents a single health check.
type DoctorCheck struct {
	Name        string `json:"name"`
	Status      string `json:"status"` // pass, fail, warn, skip
	Message     string `json:"message"`
	ErrorCode   string `json:"error_code,omitempty"`
	FixHint     string `json:"fix_hint,omitempty"`
	Documentation string `json:"documentation,omitempty"`
}

// DoctorReport contains all health check results.
type DoctorReport struct {
	PackPath    string        `json:"pack_path"`
	Overall     string        `json:"overall"` // healthy, needs_attention, critical
	Checks      []DoctorCheck `json:"checks"`
	Remediation []string      `json:"remediation"`
	Summary     DoctorSummary `json:"summary"`
}

// DoctorSummary provides check counts.
type DoctorSummary struct {
	Pass   int `json:"pass"`
	Fail   int `json:"fail"`
	Warn   int `json:"warn"`
	Skip   int `json:"skip"`
	Total  int `json:"total"`
}

// Doctor runs comprehensive health checks on packs.
type Doctor struct {
	Linter   *Linter
	Harness  *Runner
	Fixtures string
}

// NewDoctor creates a new pack doctor.
func NewDoctor(fixturesDir string) *Doctor {
	return &Doctor{
		Linter:   NewLinter(),
		Harness:  NewRunner(fixturesDir),
		Fixtures: fixturesDir,
	}
}

// Diagnose runs all health checks on a pack.
func (d *Doctor) Diagnose(packPath string) *DoctorReport {
	report := &DoctorReport{
		PackPath:    packPath,
		Checks:      []DoctorCheck{},
		Remediation: []string{},
	}

	// Run lint check
	report.addCheck(d.checkLint(packPath))

	// Run conformance test
	report.addCheck(d.checkConformance(packPath))

	// Run signing verification
	report.addCheck(d.checkSigning(packPath))

	// Run structure check
	report.addCheck(d.checkStructure(packPath))

	// Run determinism check
	report.addCheck(d.checkDeterminism(packPath))

	// Update summary and overall status
	report.updateSummary()
	report.determineOverall()
	report.generateRemediation()

	return report
}

// checkLint runs the linter.
func (d *Doctor) checkLint(packPath string) DoctorCheck {
	result := d.Linter.LintPack(packPath)

	if result.Passed && result.Summary.Warnings == 0 {
		return DoctorCheck{
			Name:    "Lint",
			Status:  "pass",
			Message: "No linting issues found",
		}
	}

	if !result.Passed {
		return DoctorCheck{
			Name:          "Lint",
			Status:        "fail",
			Message:       fmt.Sprintf("%d lint errors found", result.Summary.Errors),
			ErrorCode:     "LINT_ERRORS",
			FixHint:       "Run 'reach pack lint' for details and fix all errors",
			Documentation: "docs/PACK_DEVKIT.md",
		}
	}

	return DoctorCheck{
		Name:    "Lint",
		Status:  "warn",
		Message: fmt.Sprintf("%d lint warnings found", result.Summary.Warnings),
		FixHint: "Run 'reach pack lint' for details",
	}
}

// checkConformance runs conformance tests.
func (d *Doctor) checkConformance(packPath string) DoctorCheck {
	// Check if pack has conformance tests
	testDir := filepath.Join(packPath, "tests")
	if _, err := os.Stat(testDir); os.IsNotExist(err) {
		return DoctorCheck{
			Name:    "Conformance Tests",
			Status:  "skip",
			Message: "No tests directory found",
			FixHint: "Create tests/ directory with conformance tests",
		}
	}

	// Check for conformance test files
	entries, err := os.ReadDir(testDir)
	if err != nil || len(entries) == 0 {
		return DoctorCheck{
			Name:    "Conformance Tests",
			Status:  "warn",
			Message: "No test files found in tests/",
			FixHint: "Add conformance tests to tests/ directory",
		}
	}

	return DoctorCheck{
		Name:    "Conformance Tests",
		Status:  "pass",
		Message: fmt.Sprintf("Found %d test files", len(entries)),
	}
}

// checkSigning verifies signing configuration.
func (d *Doctor) checkSigning(packPath string) DoctorCheck {
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return DoctorCheck{
			Name:    "Signing",
			Status:  "skip",
			Message: "Could not read pack.json",
		}
	}

	var pack map[string]any
	if err := json.Unmarshal(data, &pack); err != nil {
		return DoctorCheck{
			Name:    "Signing",
			Status:  "skip",
			Message: "Invalid pack.json",
		}
	}

	// Check if signing is configured
	signing, hasSigning := pack["signing"].(map[string]any)
	if !hasSigning {
		return DoctorCheck{
			Name:    "Signing",
			Status:  "warn",
			Message: "No signing configuration found",
			FixHint: "Add signing configuration for production packs",
		}
	}

	// Check if signing is required and signature is present
	if required, ok := signing["required"].(bool); ok && required {
		sig, hasSig := pack["signature_hash"].(string)
		if !hasSig || sig == "" {
			return DoctorCheck{
				Name:      "Signing",
				Status:    "fail",
				Message:   "Signing required but pack is not signed",
				ErrorCode: "SIGNING_REQUIRED",
				FixHint:   "Sign the pack with 'reach pack sign'",
			}
		}
		return DoctorCheck{
			Name:    "Signing",
			Status:  "pass",
			Message: "Pack is properly signed",
		}
	}

	return DoctorCheck{
		Name:    "Signing",
		Status:  "pass",
		Message: "Signing configured but not required",
	}
}

// checkStructure validates pack directory structure.
func (d *Doctor) checkStructure(packPath string) DoctorCheck {
	requiredFiles := []string{"pack.json", "README.md"}
	missing := []string{}

	for _, file := range requiredFiles {
		path := filepath.Join(packPath, file)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			missing = append(missing, file)
		}
	}

	if len(missing) > 0 {
		return DoctorCheck{
			Name:      "Structure",
			Status:    "fail",
			Message:   fmt.Sprintf("Missing required files: %v", missing),
			ErrorCode: "MISSING_FILES",
			FixHint:   fmt.Sprintf("Create the following files: %v", missing),
		}
	}

	return DoctorCheck{
		Name:    "Structure",
		Status:  "pass",
		Message: "All required files present",
	}
}

// checkDeterminism validates determinism configuration.
func (d *Doctor) checkDeterminism(packPath string) DoctorCheck {
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return DoctorCheck{
			Name:    "Determinism",
			Status:  "skip",
			Message: "Could not read pack.json",
		}
	}

	var pack map[string]any
	if err := json.Unmarshal(data, &pack); err != nil {
		return DoctorCheck{
			Name:    "Determinism",
			Status:  "skip",
			Message: "Invalid pack.json",
		}
	}

	deterministic, ok := pack["deterministic"].(bool)
	if !ok {
		return DoctorCheck{
			Name:    "Determinism",
			Status:  "warn",
			Message: "deterministic field not set, defaults to false",
			FixHint: "Explicitly set deterministic: true for reproducible packs",
		}
	}

	if !deterministic {
		return DoctorCheck{
			Name:    "Determinism",
			Status:  "warn",
			Message: "Pack is not deterministic",
			FixHint: "Set deterministic: true for reproducible execution",
		}
	}

	return DoctorCheck{
		Name:    "Determinism",
		Status:  "pass",
		Message: "Pack is configured for deterministic execution",
	}
}

// addCheck adds a check to the report.
func (r *DoctorReport) addCheck(check DoctorCheck) {
	r.Checks = append(r.Checks, check)
}

// updateSummary updates the summary counts.
func (r *DoctorReport) updateSummary() {
	for _, check := range r.Checks {
		r.Summary.Total++
		switch check.Status {
		case "pass":
			r.Summary.Pass++
		case "fail":
			r.Summary.Fail++
		case "warn":
			r.Summary.Warn++
		case "skip":
			r.Summary.Skip++
		}
	}
}

// determineOverall sets the overall status.
func (r *DoctorReport) determineOverall() {
	if r.Summary.Fail > 0 {
		r.Overall = "critical"
	} else if r.Summary.Warn > 0 {
		r.Overall = "needs_attention"
	} else {
		r.Overall = "healthy"
	}
}

// generateRemediation creates the remediation checklist.
func (r *DoctorReport) generateRemediation() {
	for _, check := range r.Checks {
		if check.Status == "fail" && check.FixHint != "" {
			r.Remediation = append(r.Remediation, fmt.Sprintf("[%s] %s", check.Name, check.FixHint))
		}
	}
}

// ToJSON returns the report as JSON.
func (r *DoctorReport) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// ToHuman returns a human-readable report.
func (r *DoctorReport) ToHuman() string {
	var sb strings.Builder

	statusEmoji := map[string]string{
		"healthy":          "✓",
		"needs_attention":  "⚠",
		"critical":         "✗",
	}

	sb.WriteString(fmt.Sprintf("%s Pack Health Report: %s\n", statusEmoji[r.Overall], r.PackPath))
	sb.WriteString(fmt.Sprintf("Overall Status: %s\n\n", strings.ToUpper(r.Overall)))

	sb.WriteString("Checks:\n")
	for _, check := range r.Checks {
		emoji := map[string]string{
			"pass":  "✓",
			"fail":  "✗",
			"warn":  "⚠",
			"skip":  "⊘",
		}[check.Status]
		sb.WriteString(fmt.Sprintf("  %s %s: %s\n", emoji, check.Name, check.Message))
	}

	sb.WriteString(fmt.Sprintf("\nSummary: %d passed, %d failed, %d warnings, %d skipped\n",
		r.Summary.Pass, r.Summary.Fail, r.Summary.Warn, r.Summary.Skip))

	if len(r.Remediation) > 0 {
		sb.WriteString("\nRemediation Checklist:\n")
		for i, item := range r.Remediation {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, item))
		}
	}

	return sb.String()
}
