// Package harness provides automated documentation generation for Reach packs.
package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DocsGenerator generates documentation for packs.
type DocsGenerator struct {
	TemplateDir string
}

// NewDocsGenerator creates a new documentation generator.
func NewDocsGenerator(templateDir string) *DocsGenerator {
	return &DocsGenerator{
		TemplateDir: templateDir,
	}
}

// PackDocs represents generated pack documentation.
type PackDocs struct {
	Metadata     PackMetadataDoc   `json:"metadata"`
	Description  string            `json:"description"`
	Installation string            `json:"installation"`
	Usage        string            `json:"usage"`
	Examples     []ExampleDoc      `json:"examples"`
	APIReference *APIReferenceDoc  `json:"api_reference,omitempty"`
	Scores       *ScoreReport      `json:"scores,omitempty"`
	Badges       []string          `json:"badges"`
	Tools        []ToolDoc         `json:"tools"`
	Permissions  []PermissionDoc   `json:"permissions"`
	Determinism  DeterminismDoc    `json:"determinism"`
	Changelog    []ChangelogEntry  `json:"changelog,omitempty"`
	GeneratedAt  time.Time         `json:"generated_at"`
}

// PackMetadataDoc represents pack metadata for docs.
type PackMetadataDoc struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	SpecVersion string `json:"spec_version"`
	Author      string `json:"author"`
	Created     string `json:"created"`
	Repository  string `json:"repository,omitempty"`
	License     string `json:"license,omitempty"`
}

// ExampleDoc represents a usage example.
type ExampleDoc struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Command     string            `json:"command"`
	Inputs      map[string]string `json:"inputs,omitempty"`
	Expected    string            `json:"expected,omitempty"`
}

// APIReferenceDoc represents API reference documentation.
type APIReferenceDoc struct {
	Inputs  []ParameterDoc `json:"inputs"`
	Outputs []ParameterDoc `json:"outputs"`
	Errors  []ErrorDoc     `json:"errors"`
}

// ParameterDoc represents a parameter.
type ParameterDoc struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Description string `json:"description"`
	Default     string `json:"default,omitempty"`
}

// ErrorDoc represents an error case.
type ErrorDoc struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Resolution  string `json:"resolution"`
}

// ToolDoc represents a declared tool.
type ToolDoc struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// PermissionDoc represents a declared permission.
type PermissionDoc struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Risk        string `json:"risk,omitempty"` // low, medium, high
}

// DeterminismDoc represents determinism information.
type DeterminismDoc struct {
	IsDeterministic bool   `json:"is_deterministic"`
	Replayable      bool   `json:"replayable"`
	Notes           string `json:"notes,omitempty"`
}

// ChangelogEntry represents a changelog entry.
type ChangelogEntry struct {
	Version string `json:"version"`
	Date    string `json:"date"`
	Changes []string `json:"changes"`
}

// GenerateDocs generates documentation for a pack.
func (g *DocsGenerator) GenerateDocs(packPath string, withScores bool) (*PackDocs, error) {
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

	docs := &PackDocs{
		Metadata: PackMetadataDoc{
			ID:          pack.Metadata.ID,
			Name:        pack.Metadata.Name,
			Version:     pack.Metadata.Version,
			SpecVersion: pack.Metadata.SpecVersion,
			Author:      pack.Metadata.Author,
			Created:     pack.Metadata.Created,
		},
		Description: pack.Metadata.Description,
		GeneratedAt: time.Now().UTC(),
		Determinism: DeterminismDoc{
			IsDeterministic: pack.DeterministicFlag,
			Replayable:      pack.DeterministicFlag,
		},
	}

	// Load README for additional content
	readmePath := filepath.Join(packPath, "README.md")
	if readmeData, err := os.ReadFile(readmePath); err == nil {
		// Extract description from README if pack description is minimal
		if len(docs.Description) < 20 {
			docs.Description = extractFirstParagraph(string(readmeData))
		}
	}

	// Load tools documentation
	docs.Tools = make([]ToolDoc, len(pack.DeclaredTools))
	for i, tool := range pack.DeclaredTools {
		docs.Tools[i] = ToolDoc{
			Name:        tool,
			Description: inferToolDescription(tool),
		}
	}

	// Load permissions documentation
	docs.Permissions = make([]PermissionDoc, len(pack.DeclaredPermissions))
	for i, perm := range pack.DeclaredPermissions {
		docs.Permissions[i] = PermissionDoc{
			Name:        perm,
			Description: inferPermissionDescription(perm),
			Risk:        assessPermissionRisk(perm),
		}
	}

	// Generate installation instructions
	docs.Installation = g.generateInstallation(&pack)

	// Generate usage instructions
	docs.Usage = g.generateUsage(&pack)

	// Extract examples from execution graph
	docs.Examples = g.extractExamples(&pack)

	// Generate API reference
	docs.APIReference = g.generateAPIReference(&pack)

	// Load or generate changelog
	docs.Changelog = g.loadChangelog(packPath, &pack)

	// Add scores if requested
	if withScores {
		scorer := NewScorer(filepath.Join(packPath, "..", "fixtures"))
		scoreReport, err := scorer.ScorePack(packPath)
		if err == nil {
			docs.Scores = scoreReport
			docs.Badges = scoreReport.Badges
		}
	}

	return docs, nil
}

// GenerateMarkdown generates markdown documentation.
func (g *DocsGenerator) GenerateMarkdown(docs *PackDocs) string {
	var sb strings.Builder

	// Header with badges
	sb.WriteString(fmt.Sprintf("# %s\n\n", docs.Metadata.Name))

	// Badges
	if len(docs.Badges) > 0 {
		for _, badge := range docs.Badges {
			shieldBadge := convertToShieldBadge(badge)
			if shieldBadge != "" {
				sb.WriteString(shieldBadge + " ")
			}
		}
		sb.WriteString("\n\n")
	}

	// Description
	sb.WriteString(fmt.Sprintf("%s\n\n", docs.Description))

	// Installation
	sb.WriteString("## Installation\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString(docs.Installation)
	sb.WriteString("\n```\n\n")

	// Usage
	sb.WriteString("## Usage\n\n")
	sb.WriteString(docs.Usage)
	sb.WriteString("\n\n")

	// Examples
	if len(docs.Examples) > 0 {
		sb.WriteString("## Examples\n\n")
		for i, ex := range docs.Examples {
			sb.WriteString(fmt.Sprintf("### Example %d: %s\n\n", i+1, ex.Name))
			sb.WriteString(fmt.Sprintf("%s\n\n", ex.Description))
			sb.WriteString("```bash\n")
			sb.WriteString(ex.Command)
			sb.WriteString("\n```\n\n")
			if ex.Expected != "" {
				sb.WriteString("**Expected output:**\n\n")
				sb.WriteString("```\n")
				sb.WriteString(ex.Expected)
				sb.WriteString("\n```\n\n")
			}
		}
	}

	// API Reference
	if docs.APIReference != nil {
		sb.WriteString("## API Reference\n\n")

		if len(docs.APIReference.Inputs) > 0 {
			sb.WriteString("### Inputs\n\n")
			sb.WriteString("| Name | Type | Required | Description |\n")
			sb.WriteString("|------|------|----------|-------------|\n")
			for _, input := range docs.APIReference.Inputs {
				req := "No"
				if input.Required {
					req = "Yes"
				}
				sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", input.Name, input.Type, req, input.Description))
			}
			sb.WriteString("\n")
		}

		if len(docs.APIReference.Outputs) > 0 {
			sb.WriteString("### Outputs\n\n")
			sb.WriteString("| Name | Type | Description |\n")
			sb.WriteString("|------|------|-------------|\n")
			for _, output := range docs.APIReference.Outputs {
				sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", output.Name, output.Type, output.Description))
			}
			sb.WriteString("\n")
		}

		if len(docs.APIReference.Errors) > 0 {
			sb.WriteString("### Errors\n\n")
			sb.WriteString("| Code | Description | Resolution |\n")
			sb.WriteString("|------|-------------|------------|\n")
			for _, err := range docs.APIReference.Errors {
				sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", err.Code, err.Description, err.Resolution))
			}
			sb.WriteString("\n")
		}
	}

	// Declared Tools
	if len(docs.Tools) > 0 {
		sb.WriteString("## Declared Tools\n\n")
		for _, tool := range docs.Tools {
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", tool.Name, tool.Description))
		}
		sb.WriteString("\n")
	}

	// Declared Permissions
	if len(docs.Permissions) > 0 {
		sb.WriteString("## Required Permissions\n\n")
		sb.WriteString("| Permission | Risk Level | Description |\n")
		sb.WriteString("|------------|------------|-------------|\n")
		for _, perm := range docs.Permissions {
			riskEmoji := map[string]string{
				"low":    "🟢",
				"medium": "🟡",
				"high":   "🔴",
			}[perm.Risk]
			sb.WriteString(fmt.Sprintf("| %s | %s %s | %s |\n", perm.Name, riskEmoji, perm.Risk, perm.Description))
		}
		sb.WriteString("\n")
	}

	// Determinism
	sb.WriteString("## Determinism\n\n")
	if docs.Determinism.IsDeterministic {
		sb.WriteString("✅ This pack is **deterministic** and produces identical results across runs.\n\n")
	} else {
		sb.WriteString("⚠️ This pack is **non-deterministic** and may produce different results across runs.\n\n")
	}
	if docs.Determinism.Notes != "" {
		sb.WriteString(fmt.Sprintf("*Note: %s*\n\n", docs.Determinism.Notes))
	}

	// Scores
	if docs.Scores != nil {
		sb.WriteString("## Quality Scores\n\n")
		sb.WriteString(fmt.Sprintf("**Overall Grade**: %s (%.1f/100)\n\n", docs.Scores.Grade, docs.Scores.Overall))
		sb.WriteString("| Category | Score |\n")
		sb.WriteString("|----------|-------|\n")
		sb.WriteString(fmt.Sprintf("| Determinism | %d/100 |\n", docs.Scores.Scores.Determinism))
		sb.WriteString(fmt.Sprintf("| Policy Hygiene | %d/100 |\n", docs.Scores.Scores.PolicyHygiene))
		sb.WriteString(fmt.Sprintf("| Supply Chain | %d/100 |\n", docs.Scores.Scores.SupplyChain))
		sb.WriteString(fmt.Sprintf("| Performance | %d/100 |\n\n", docs.Scores.Scores.Performance))
	}

	// Changelog
	if len(docs.Changelog) > 0 {
		sb.WriteString("## Changelog\n\n")
		for _, entry := range docs.Changelog {
			sb.WriteString(fmt.Sprintf("### %s (%s)\n\n", entry.Version, entry.Date))
			for _, change := range entry.Changes {
				sb.WriteString(fmt.Sprintf("- %s\n", change))
			}
			sb.WriteString("\n")
		}
	}

	// Footer
	sb.WriteString("---\n\n")
	sb.WriteString(fmt.Sprintf("*Documentation generated by Reach Autopack on %s*\n", docs.GeneratedAt.Format(time.RFC3339)))

	return sb.String()
}

// WriteDocs writes documentation to a file.
func (g *DocsGenerator) WriteDocs(docs *PackDocs, outputPath string) error {
	markdown := g.GenerateMarkdown(docs)
	return os.WriteFile(outputPath, []byte(markdown), 0644)
}

// Helper functions

func extractFirstParagraph(readme string) string {
	lines := strings.Split(readme, "\n")
	var paragraph strings.Builder
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" && paragraph.Len() > 0 {
			break
		}
		if line != "" && !strings.HasPrefix(line, "#") {
			if paragraph.Len() > 0 {
				paragraph.WriteString(" ")
			}
			paragraph.WriteString(line)
		}
	}
	return paragraph.String()
}

func inferToolDescription(tool string) string {
	descriptions := map[string]string{
		"echo":       "Output text to stdout",
		"read_file":  "Read file contents",
		"write_file": "Write content to file",
		"exec":       "Execute external command",
		"http_get":   "Perform HTTP GET request",
		"http_post":  "Perform HTTP POST request",
		"json_parse": "Parse JSON string",
		"env_get":    "Get environment variable",
	}
	if desc, ok := descriptions[tool]; ok {
		return desc
	}
	return fmt.Sprintf("Tool: %s", tool)
}

func inferPermissionDescription(perm string) string {
	descriptions := map[string]string{
		"fs:read":     "Read from filesystem",
		"fs:write":    "Write to filesystem",
		"fs:delete":   "Delete files",
		"net:http":    "Make HTTP requests",
		"sys:exec":    "Execute system commands",
		"sys:admin":   "Administrative system access",
		"env:read":    "Read environment variables",
	}
	if desc, ok := descriptions[perm]; ok {
		return desc
	}
	return fmt.Sprintf("Permission: %s", perm)
}

func assessPermissionRisk(perm string) string {
	highRisk := []string{"sys:admin", "sys:exec", "fs:delete"}
	mediumRisk := []string{"net:http", "fs:write", "env:read"}

	for _, r := range highRisk {
		if perm == r {
			return "high"
		}
	}
	for _, r := range mediumRisk {
		if perm == r {
			return "medium"
		}
	}
	return "low"
}

func (g *DocsGenerator) generateInstallation(pack *PackDefinition) string {
	return fmt.Sprintf("reach packs install %s@%s", pack.Metadata.ID, pack.Metadata.Version)
}

func (g *DocsGenerator) generateUsage(pack *PackDefinition) string {
	return fmt.Sprintf("reach run %s@%s [inputs...]", pack.Metadata.ID, pack.Metadata.Version)
}

func (g *DocsGenerator) extractExamples(pack *PackDefinition) []ExampleDoc {
	examples := []ExampleDoc{}

	// Generate example from first execution step
	if len(pack.ExecutionGraph.Steps) > 0 {
		step := pack.ExecutionGraph.Steps[0]
		examples = append(examples, ExampleDoc{
			Name:        "Basic Usage",
			Description: fmt.Sprintf("Execute the %s step", step.Tool),
			Command:     fmt.Sprintf("reach run %s", pack.Metadata.ID),
			Expected:    step.Output,
		})
	}

	// Add more examples if available
	if len(pack.ExecutionGraph.Steps) > 1 {
		examples = append(examples, ExampleDoc{
			Name:        "Full Workflow",
			Description: "Execute all steps in the pack",
			Command:     fmt.Sprintf("reach run %s --full", pack.Metadata.ID),
		})
	}

	return examples
}

func (g *DocsGenerator) generateAPIReference(pack *PackDefinition) *APIReferenceDoc {
	ref := &APIReferenceDoc{
		Inputs:  []ParameterDoc{},
		Outputs: []ParameterDoc{},
		Errors:  []ErrorDoc{},
	}

	// Infer inputs from execution graph
	for _, step := range pack.ExecutionGraph.Steps {
		if step.Input != "" {
			ref.Inputs = append(ref.Inputs, ParameterDoc{
				Name:        fmt.Sprintf("step_%s_input", step.ID),
				Type:        "string",
				Required:    true,
				Description: fmt.Sprintf("Input for step %s (%s)", step.ID, step.Tool),
			})
		}
	}

	// Add standard errors
	ref.Errors = []ErrorDoc{
		{
			Code:        "PACK_NOT_FOUND",
			Description: "The specified pack was not found",
			Resolution:  "Verify pack ID and version are correct",
		},
		{
			Code:        "TOOL_NOT_ALLOWED",
			Description: "Attempted to use a tool not in declared_tools",
			Resolution:  "Add the tool to pack.json declared_tools",
		},
		{
			Code:        "PERMISSION_DENIED",
			Description: "Pack attempted operation without required permission",
			Resolution:  "Add permission to pack.json declared_permissions",
		},
	}

	return ref
}

func (g *DocsGenerator) loadChangelog(packPath string, pack *PackDefinition) []ChangelogEntry {
	changelogPath := filepath.Join(packPath, "CHANGELOG.md")
	data, err := os.ReadFile(changelogPath)
	if err != nil {
		// Return synthetic changelog from pack version
		return []ChangelogEntry{
			{
				Version: pack.Metadata.Version,
				Date:    pack.Metadata.Created,
				Changes: []string{"Initial release"},
			},
		}
	}

	// Simple changelog parsing - in production, use proper markdown parsing
	_ = data
	return []ChangelogEntry{
		{
			Version: pack.Metadata.Version,
			Date:    pack.Metadata.Created,
			Changes: []string{"See CHANGELOG.md for full history"},
		},
	}
}

func convertToShieldBadge(badge string) string {
	// Convert emoji badges to shields.io badges
	badgeMap := map[string]string{
		"🏆 Gold":         "![Quality](https://img.shields.io/badge/quality-gold-yellow)",
		"🥈 Silver":       "![Quality](https://img.shields.io/badge/quality-silver-lightgrey)",
		"🥉 Bronze":       "![Quality](https://img.shields.io/badge/quality-bronze-orange)",
		"⚠️ Needs Work":   "![Quality](https://img.shields.io/badge/quality-needs%20work-red)",
		"🔒 Deterministic": "![Determinism](https://img.shields.io/badge/determinism-locked-blue)",
		"🛡️ Minimal":      "![Policy](https://img.shields.io/badge/policy-minimal-green)",
		"✅ Verified":      "![Verified](https://img.shields.io/badge/verified-yes-brightgreen)",
		"🚀 Fast":         "![Performance](https://img.shields.io/badge/performance-fast-success)",
	}

	for key, value := range badgeMap {
		if badge == key {
			return value
		}
	}
	return ""
}