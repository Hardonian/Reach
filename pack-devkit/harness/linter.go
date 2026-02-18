// Package harness provides pack linting capabilities.
package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// LintRule represents a linting rule.
type LintRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity"` // error, warning, info
	Category    string `json:"category"` // schema, security, determinism, policy
}

// LintIssue represents a linting issue found.
type LintIssue struct {
	RuleID   string `json:"rule_id"`
	Message  string `json:"message"`
	File     string `json:"file"`
	Line     int    `json:"line,omitempty"`
	Severity string `json:"severity"`
	FixHint  string `json:"fix_hint,omitempty"`
}

// LintResult contains all issues found during linting.
type LintResult struct {
	PackPath string      `json:"pack_path"`
	Passed   bool        `json:"passed"`
	Issues   []LintIssue `json:"issues"`
	Summary  LintSummary `json:"summary"`
}

// LintSummary provides counts by severity.
type LintSummary struct {
	Errors   int `json:"errors"`
	Warnings int `json:"warnings"`
	Info     int `json:"info"`
	Total    int `json:"total"`
}

// Linter checks packs for compliance.
type Linter struct {
	Rules []LintRule
}

// NewLinter creates a new pack linter with default rules.
func NewLinter() *Linter {
	return &Linter{
		Rules: []LintRule{
			{ID: "spec-version", Name: "Spec Version Pin", Description: "specVersion must be present and valid", Severity: "error", Category: "schema"},
			{ID: "policy-contract", Name: "Policy Contract", Description: "Policy contract file must be present and valid", Severity: "error", Category: "policy"},
			{ID: "capability-match", Name: "Capability Match", Description: "Declared capabilities must match tool usage", Severity: "warning", Category: "schema"},
			{ID: "signing-metadata", Name: "Signing Metadata", Description: "Signing metadata must be present when required", Severity: "warning", Category: "security"},
			{ID: "no-non-determinism", Name: "No Non-Determinism", Description: "No forbidden patterns in deterministic core files", Severity: "error", Category: "determinism"},
			{ID: "schema-valid", Name: "Schema Valid", Description: "File and manifest must be schema-valid", Severity: "error", Category: "schema"},
			{ID: "required-fields", Name: "Required Fields", Description: "Required metadata fields must be present", Severity: "error", Category: "schema"},
		},
	}
}

// LintPack checks a pack at the given path.
func (l *Linter) LintPack(packPath string) *LintResult {
	result := &LintResult{
		PackPath: packPath,
		Passed:   true,
		Issues:   []LintIssue{},
	}

	// Check pack.json exists
	packJSONPath := filepath.Join(packPath, "pack.json")
	if _, err := os.Stat(packJSONPath); os.IsNotExist(err) {
		result.addIssue("schema-valid", "pack.json not found", packPath, 0, "error",
			"Create pack.json with required fields: metadata, declared_tools, etc.")
		return result
	}

	// Load pack.json
	packData, err := os.ReadFile(packJSONPath)
	if err != nil {
		result.addIssue("schema-valid", fmt.Sprintf("Failed to read pack.json: %v", err), packJSONPath, 0, "error",
			"Ensure pack.json is readable")
		return result
	}

	var pack map[string]any
	if err := json.Unmarshal(packData, &pack); err != nil {
		result.addIssue("schema-valid", fmt.Sprintf("Invalid JSON in pack.json: %v", err), packJSONPath, 0, "error",
			"Fix JSON syntax errors")
		return result
	}

	// Check spec version
	l.checkSpecVersion(pack, packJSONPath, result)

	// Check required fields
	l.checkRequiredFields(pack, packJSONPath, result)

	// Check policy contract
	l.checkPolicyContract(packPath, pack, result)

	// Check signing metadata
	l.checkSigningMetadata(pack, packJSONPath, result)

	// Check for non-deterministic patterns
	l.checkNonDeterminism(packPath, result)

	// Check capability match
	l.checkCapabilityMatch(pack, packJSONPath, result)

	// Update summary
	result.updateSummary()

	return result
}

// checkSpecVersion validates the spec version.
func (l *Linter) checkSpecVersion(pack map[string]any, file string, result *LintResult) {
	specVersion, ok := pack["spec_version"].(string)
	if !ok || specVersion == "" {
		result.addIssue("spec-version", "spec_version is required", file, 0, "error",
			"Add \"spec_version\": \"1.0\" to pack.json")
		return
	}

	validVersions := []string{"1.0"}
	found := false
	for _, v := range validVersions {
		if specVersion == v {
			found = true
			break
		}
	}

	if !found {
		result.addIssue("spec-version", fmt.Sprintf("Invalid spec_version: %s", specVersion), file, 0, "error",
			fmt.Sprintf("Use one of: %v", validVersions))
	}
}

// checkRequiredFields validates required metadata fields.
func (l *Linter) checkRequiredFields(pack map[string]any, file string, result *LintResult) {
	requiredTopLevel := []string{"metadata", "declared_tools", "deterministic"}
	for _, field := range requiredTopLevel {
		if _, ok := pack[field]; !ok {
			result.addIssue("required-fields", fmt.Sprintf("Missing required field: %s", field), file, 0, "error",
				fmt.Sprintf("Add \"%s\": <value> to pack.json", field))
		}
	}

	// Check metadata fields
	if metadata, ok := pack["metadata"].(map[string]any); ok {
		requiredMeta := []string{"id", "version", "name", "author"}
		for _, field := range requiredMeta {
			if val, ok := metadata[field]; !ok || val == "" {
				result.addIssue("required-fields", fmt.Sprintf("Missing required metadata field: %s", field), file, 0, "error",
					fmt.Sprintf("Add \"%s\": \"<value>\" to metadata", field))
			}
		}
	}
}

// checkPolicyContract validates the policy contract file.
func (l *Linter) checkPolicyContract(packPath string, pack map[string]any, result *LintResult) {
	// Check if policy contract is referenced
	policyFile := "policy.rego" // Default
	if pf, ok := pack["policy_contract"].(string); ok {
		policyFile = pf
	}

	policyPath := filepath.Join(packPath, policyFile)
	if _, err := os.Stat(policyPath); os.IsNotExist(err) {
		// Check if it's a governed pack that should have a policy
		if isGoverned, ok := pack["governed"].(bool); ok && isGoverned {
			result.addIssue("policy-contract", fmt.Sprintf("Policy contract file not found: %s", policyFile), policyPath, 0, "error",
				"Create policy contract file or set governed: false")
		}
		return
	}

	// Validate policy file content (basic check)
	content, err := os.ReadFile(policyPath)
	if err != nil {
		result.addIssue("policy-contract", fmt.Sprintf("Failed to read policy file: %v", err), policyPath, 0, "error",
			"Ensure policy file is readable")
		return
	}

	// Check for basic Rego structure
	contentStr := string(content)
	if !strings.Contains(contentStr, "package") {
		result.addIssue("policy-contract", "Policy file missing package declaration", policyPath, 0, "error",
			"Add 'package reach.policy' to policy file")
	}
}

// checkSigningMetadata validates signing configuration.
func (l *Linter) checkSigningMetadata(pack map[string]any, file string, result *LintResult) {
	// Check if signing is required
	signingRequired := false
	if signing, ok := pack["signing"].(map[string]any); ok {
		if req, ok := signing["required"].(bool); ok {
			signingRequired = req
		}
	}

	if signingRequired {
		// Check for signature_hash
		if sig, ok := pack["signature_hash"].(string); !ok || sig == "" {
			result.addIssue("signing-metadata", "Signing is required but signature_hash is missing", file, 0, "error",
				"Sign the pack and add signature_hash")
		}
	}
}

// checkNonDeterminism scans for forbidden patterns.
func (l *Linter) checkNonDeterminism(packPath string, result *LintResult) {
	// Patterns that break determinism
	forbiddenPatterns := []struct {
		pattern string
		hint    string
	}{
		{`\bDate\.now\(\)`, "Use deterministic timestamp from execution context"},
		{`\bMath\.random\(\)`, "Use deterministic random from seeded RNG"},
		{`\bnew Date\(\)`, "Use deterministic timestamp from execution context"},
		{`\bsetTimeout\(`, "Avoid timeouts in deterministic execution"},
		{`\bsetInterval\(`, "Avoid intervals in deterministic execution"},
		{`\bprocess\.env\[`, "Use declared environment variables only"},
	}

	// Scan all .js and .ts files in the pack
	_ = filepath.Walk(packPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".js" && ext != ".ts" && ext != ".go" {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil // Skip unreadable files
		}

		contentStr := string(content)
		for _, fp := range forbiddenPatterns {
			re := regexp.MustCompile(fp.pattern)
			matches := re.FindAllStringIndex(contentStr, -1)
			for _, match := range matches {
				line := strings.Count(contentStr[:match[0]], "\n") + 1
				result.addIssue("no-non-determinism",
					fmt.Sprintf("Forbidden pattern found: %s", fp.pattern),
					path, line, "error", fp.hint)
			}
		}

		return nil
	})
}

// checkCapabilityMatch verifies declared capabilities match tool usage.
func (l *Linter) checkCapabilityMatch(pack map[string]any, file string, result *LintResult) {
	declaredTools, _ := pack["declared_tools"].([]any)
	declaredPerms, _ := pack["declared_permissions"].([]any)

	// This is a simplified check - in production, you'd analyze the execution graph
	if len(declaredTools) == 0 && len(declaredPerms) > 0 {
		result.addIssue("capability-match", "Permissions declared but no tools declared", file, 0, "warning",
			"Either add tools or remove unnecessary permissions")
	}
}

// addIssue adds an issue to the result.
func (r *LintResult) addIssue(ruleID, message, file string, line int, severity, fixHint string) {
	r.Issues = append(r.Issues, LintIssue{
		RuleID:   ruleID,
		Message:  message,
		File:     file,
		Line:     line,
		Severity: severity,
		FixHint:  fixHint,
	})

	if severity == "error" {
		r.Passed = false
	}
}

// updateSummary updates the summary counts.
func (r *LintResult) updateSummary() {
	for _, issue := range r.Issues {
		r.Summary.Total++
		switch issue.Severity {
		case "error":
			r.Summary.Errors++
		case "warning":
			r.Summary.Warnings++
		case "info":
			r.Summary.Info++
		}
	}
}

// ToJSON returns the lint result as JSON.
func (r *LintResult) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// ToHuman returns a human-readable report.
func (r *LintResult) ToHuman() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Pack: %s\n", r.PackPath))
	sb.WriteString(fmt.Sprintf("Status: %s\n", map[bool]string{true: "PASSED", false: "FAILED"}[r.Passed]))
	sb.WriteString(fmt.Sprintf("Issues: %d errors, %d warnings, %d info\n\n",
		r.Summary.Errors, r.Summary.Warnings, r.Summary.Info))

	if len(r.Issues) == 0 {
		sb.WriteString("No issues found!\n")
		return sb.String()
	}

	for _, issue := range r.Issues {
		sb.WriteString(fmt.Sprintf("[%s] %s\n", strings.ToUpper(issue.Severity), issue.RuleID))
		sb.WriteString(fmt.Sprintf("  File: %s", issue.File))
		if issue.Line > 0 {
			sb.WriteString(fmt.Sprintf(":%d", issue.Line))
		}
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf("  Message: %s\n", issue.Message))
		if issue.FixHint != "" {
			sb.WriteString(fmt.Sprintf("  Fix: %s\n", issue.FixHint))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}
