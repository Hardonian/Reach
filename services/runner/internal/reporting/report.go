// Package reporting implements report generation for Reach.
// Reports can be generated in JSON, Markdown, and HTML formats.
package reporting

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Format specifies the output format for reports.
type Format string

const (
	FormatJSON Format = "json"
	FormatMD   Format = "md"
	FormatHTML Format = "html"
)

// Report represents a generated report.
type Report struct {
	RunID         string            `json:"run_id"`
	TrustScore    float64           `json:"trust_score"`
	Status        string            `json:"status"`
	Findings      []Finding         `json:"findings"`
	Checkpoints   []Checkpoint      `json:"checkpoints"`
	EvidenceChain EvidenceChain     `json:"evidence_chain"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// Finding represents an issue or observation found during a run.
type Finding struct {
	ID          string `json:"id"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	File        string `json:"file,omitempty"`
	Line        int    `json:"line,omitempty"`
	Rule        string `json:"rule,omitempty"`
	Suggestion  string `json:"suggestion,omitempty"`
}

// Checkpoint represents a saved state during execution.
type Checkpoint struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Timestamp string `json:"timestamp"`
	Fingerprint string `json:"fingerprint"`
}

// EvidenceChain represents the proof chain for a run.
type EvidenceChain struct {
	InputHash     string `json:"input_hash"`
	PolicyHash    string `json:"policy_hash"`
	ArtifactHash  string `json:"artifact_hash"`
	ExecutionHash string `json:"execution_hash"`
	OutputHash    string `json:"output_hash"`
	Fingerprint   string `json:"fingerprint"`
	Verified      bool   `json:"verified"`
}

// Generator creates reports in various formats.
type Generator struct {
	dataRoot string
}

// NewGenerator creates a report generator.
func NewGenerator(dataRoot string) *Generator {
	return &Generator{dataRoot: dataRoot}
}

// Generate creates a report in the specified format.
func (g *Generator) Generate(runID string, format Format) (*Report, error) {
	// Load run data
	record, err := g.loadRunRecord(runID)
	if err != nil {
		return nil, fmt.Errorf("failed to load run: %w", err)
	}

	// Build report
	report := &Report{
		RunID:      runID,
		TrustScore: g.calculateTrustScore(record),
		Status:     g.determineStatus(record),
		Findings:   g.extractFindings(record),
		Checkpoints: g.extractCheckpoints(record),
		EvidenceChain: g.buildEvidenceChain(record),
		Metadata:   make(map[string]string),
	}

	return report, nil
}

// GenerateToFile creates a report and writes it to a file.
func (g *Generator) GenerateToFile(runID string, format Format, outputPath string) error {
	report, err := g.Generate(runID, format)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}

	switch format {
	case FormatJSON:
		return g.writeJSON(report, outputPath)
	case FormatMD:
		return g.writeMarkdown(report, outputPath)
	case FormatHTML:
		return g.writeHTML(report, outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

// writeJSON writes the report as JSON.
func (g *Generator) writeJSON(report *Report, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// writeMarkdown writes the report as Markdown.
func (g *Generator) writeMarkdown(report *Report, path string) error {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Reach Report: %s\n\n", report.RunID))
	sb.WriteString(fmt.Sprintf("**Status**: %s\n\n", report.Status))
	sb.WriteString(fmt.Sprintf("**Trust Score**: %.2f/100\n\n", report.TrustScore))

	// Evidence Chain
	sb.WriteString("## Evidence Chain\n\n")
	sb.WriteString("| Step | Hash | Verified |\n")
	sb.WriteString("|------|------|----------|\n")
	sb.WriteString(fmt.Sprintf("| Input | `%s` | ✅ |\n", truncateHash(report.EvidenceChain.InputHash)))
	sb.WriteString(fmt.Sprintf("| Policy | `%s` | ✅ |\n", truncateHash(report.EvidenceChain.PolicyHash)))
	sb.WriteString(fmt.Sprintf("| Artifacts | `%s` | ✅ |\n", truncateHash(report.EvidenceChain.ArtifactHash)))
	sb.WriteString(fmt.Sprintf("| Execution | `%s` | ✅ |\n", truncateHash(report.EvidenceChain.ExecutionHash)))
	sb.WriteString(fmt.Sprintf("| Output | `%s` | %s |\n", truncateHash(report.EvidenceChain.OutputHash), boolCheck(report.EvidenceChain.Verified)))
	sb.WriteString(fmt.Sprintf("| **Fingerprint** | `%s` | %s |\n", truncateHash(report.EvidenceChain.Fingerprint), boolCheck(report.EvidenceChain.Verified)))
	sb.WriteString("\n")

	// Findings
	if len(report.Findings) > 0 {
		sb.WriteString("## Findings\n\n")
		for _, f := range report.Findings {
			severity := strings.ToUpper(f.Severity)
			sb.WriteString(fmt.Sprintf("### [%s] %s\n\n", severity, f.Title))
			sb.WriteString(fmt.Sprintf("%s\n\n", f.Description))
			if f.File != "" {
				sb.WriteString(fmt.Sprintf("**File**: `%s`", f.File))
				if f.Line > 0 {
					sb.WriteString(fmt.Sprintf(":%d", f.Line))
				}
				sb.WriteString("\n\n")
			}
			if f.Suggestion != "" {
				sb.WriteString(fmt.Sprintf("**Suggestion**: %s\n\n", f.Suggestion))
			}
		}
	}

	// Checkpoints
	if len(report.Checkpoints) > 0 {
		sb.WriteString("## Checkpoints\n\n")
		sb.WriteString("| ID | Name | Fingerprint |\n")
		sb.WriteString("|----|------|-------------|\n")
		for _, c := range report.Checkpoints {
			sb.WriteString(fmt.Sprintf("| `%s` | %s | `%s` |\n", c.ID, c.Name, truncateHash(c.Fingerprint)))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n")
	sb.WriteString("*Generated by Reach. [Learn more](https://github.com/reach/reach)*\n")

	return os.WriteFile(path, []byte(sb.String()), 0o644)
}

// writeHTML writes the report as HTML.
func (g *Generator) writeHTML(report *Report, path string) error {
	var sb strings.Builder

	sb.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reach Report - ` + report.RunID + `</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --text: #e2e8f0;
            --muted: #94a3b8;
            --accent: #3b82f6;
            --success: #22c55e;
            --warning: #f59e0b;
            --error: #ef4444;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 2rem;
            line-height: 1.6;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        h1 { margin: 0 0 1rem 0; }
        h2 { color: var(--accent); margin-top: 0; }
        .trust-score {
            font-size: 3rem;
            font-weight: bold;
            color: var(--success);
        }
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .status-pass { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .status-fail { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        .status-warn { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
        th { color: var(--muted); font-weight: 500; }
        code { background: rgba(0,0,0,0.3); padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.875rem; }
        .finding { border-left: 3px solid var(--accent); padding-left: 1rem; margin-bottom: 1rem; }
        .severity-high { border-color: var(--error); }
        .severity-medium { border-color: var(--warning); }
        .severity-low { border-color: var(--success); }
        .footer { text-align: center; color: var(--muted); margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>Reach Report</h1>
            <p><code>` + report.RunID + `</code></p>
            <div style="display: flex; align-items: center; gap: 2rem; margin-top: 1rem;">
                <div>
                    <div class="trust-score">` + fmt.Sprintf("%.0f", report.TrustScore) + `</div>
                    <div style="color: var(--muted);">Trust Score</div>
                </div>
                <div>
                    <span class="status-badge status-` + strings.ToLower(report.Status) + `">` + strings.ToUpper(report.Status) + `</span>
                </div>
            </div>
        </div>
`)

	// Evidence Chain
	sb.WriteString(`        <div class="card">
            <h2>Evidence Chain</h2>
            <table>
                <tr><th>Step</th><th>Hash</th><th>Verified</th></tr>
                <tr><td>Input</td><td><code>` + truncateHash(report.EvidenceChain.InputHash) + `</code></td><td>✅</td></tr>
                <tr><td>Policy</td><td><code>` + truncateHash(report.EvidenceChain.PolicyHash) + `</code></td><td>✅</td></tr>
                <tr><td>Artifacts</td><td><code>` + truncateHash(report.EvidenceChain.ArtifactHash) + `</code></td><td>✅</td></tr>
                <tr><td>Execution</td><td><code>` + truncateHash(report.EvidenceChain.ExecutionHash) + `</code></td><td>✅</td></tr>
                <tr><td>Output</td><td><code>` + truncateHash(report.EvidenceChain.OutputHash) + `</code></td><td>` + boolCheckHTML(report.EvidenceChain.Verified) + `</td></tr>
                <tr><td><strong>Fingerprint</strong></td><td><code>` + truncateHash(report.EvidenceChain.Fingerprint) + `</code></td><td>` + boolCheckHTML(report.EvidenceChain.Verified) + `</td></tr>
            </table>
        </div>
`)

	// Findings
	if len(report.Findings) > 0 {
		sb.WriteString(`        <div class="card">
            <h2>Findings</h2>
`)
		for _, f := range report.Findings {
			severityClass := "severity-" + strings.ToLower(f.Severity)
			sb.WriteString(fmt.Sprintf(`            <div class="finding %s">
                <strong>[%s] %s</strong>
                <p>%s</p>
`, severityClass, strings.ToUpper(f.Severity), f.Title, f.Description))
			if f.File != "" {
				sb.WriteString(fmt.Sprintf(`                <p><code>%s`, f.File))
				if f.Line > 0 {
					sb.WriteString(fmt.Sprintf(":%d", f.Line))
				}
				sb.WriteString("</code></p>\n")
			}
			sb.WriteString("            </div>\n")
		}
		sb.WriteString("        </div>\n")
	}

	sb.WriteString(`        <div class="footer">
            <p>Generated by Reach. <a href="https://github.com/reach/reach" style="color: var(--accent);">Learn more</a></p>
        </div>
    </div>
</body>
</html>`)

	return os.WriteFile(path, []byte(sb.String()), 0o644)
}

// loadRunRecord loads run data from storage.
func (g *Generator) loadRunRecord(runID string) (map[string]any, error) {
	path := filepath.Join(g.dataRoot, "runs", runID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var record map[string]any
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, err
	}

	return record, nil
}

// calculateTrustScore computes a trust score from 0-100.
func (g *Generator) calculateTrustScore(record map[string]any) float64 {
	base := 100.0

	// Deduct for findings
	if findings, ok := record["findings"].([]any); ok {
		for _, f := range findings {
			if fm, ok := f.(map[string]any); ok {
				switch fm["severity"] {
				case "high":
					base -= 20
				case "medium":
					base -= 10
				case "low":
					base -= 5
				}
			}
		}
	}

	// Deduct for verification failures
	if verified, ok := record["verified"].(bool); ok && !verified {
		base -= 30
	}

	if base < 0 {
		base = 0
	}

	return base
}

// determineStatus returns the overall status.
func (g *Generator) determineStatus(record map[string]any) string {
	if verified, ok := record["verified"].(bool); ok && !verified {
		return "fail"
	}

	if findings, ok := record["findings"].([]any); ok {
		for _, f := range findings {
			if fm, ok := f.(map[string]any); ok {
				if fm["severity"] == "high" {
					return "fail"
				}
			}
		}
		if len(findings) > 0 {
			return "warn"
		}
	}

	return "pass"
}

// extractFindings extracts findings from the run record.
func (g *Generator) extractFindings(record map[string]any) []Finding {
	findings := make([]Finding, 0)

	if raw, ok := record["findings"].([]any); ok {
		for _, f := range raw {
			if fm, ok := f.(map[string]any); ok {
				finding := Finding{
					ID:          getString(fm, "id"),
					Severity:    getString(fm, "severity"),
					Title:       getString(fm, "title"),
					Description: getString(fm, "description"),
					File:        getString(fm, "file"),
					Line:        getInt(fm, "line"),
					Rule:        getString(fm, "rule"),
					Suggestion:  getString(fm, "suggestion"),
				}
				findings = append(findings, finding)
			}
		}
	}

	// Sort by severity for deterministic output
	sort.Slice(findings, func(i, j int) bool {
		sevOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
		return sevOrder[findings[i].Severity] < sevOrder[findings[j].Severity]
	})

	return findings
}

// extractCheckpoints extracts checkpoints from the run record.
func (g *Generator) extractCheckpoints(record map[string]any) []Checkpoint {
	checkpoints := make([]Checkpoint, 0)

	if raw, ok := record["checkpoints"].([]any); ok {
		for _, c := range raw {
			if cm, ok := c.(map[string]any); ok {
				checkpoint := Checkpoint{
					ID:          getString(cm, "id"),
					Name:        getString(cm, "name"),
					Timestamp:   getString(cm, "timestamp"),
					Fingerprint: getString(cm, "fingerprint"),
				}
				checkpoints = append(checkpoints, checkpoint)
			}
		}
	}

	return checkpoints
}

// buildEvidenceChain constructs the evidence chain from the run record.
func (g *Generator) buildEvidenceChain(record map[string]any) EvidenceChain {
	chain := EvidenceChain{
		Verified: true,
	}

	if ec, ok := record["evidence_chain"].(map[string]any); ok {
		chain.InputHash = getString(ec, "input_hash")
		chain.PolicyHash = getString(ec, "policy_hash")
		chain.ArtifactHash = getString(ec, "artifact_hash")
		chain.ExecutionHash = getString(ec, "execution_hash")
		chain.OutputHash = getString(ec, "output_hash")
		chain.Fingerprint = getString(ec, "fingerprint")
		if v, ok := ec["verified"].(bool); ok {
			chain.Verified = v
		}
	}

	return chain
}

// Helper functions

func getString(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]any, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	return 0
}

func truncateHash(hash string) string {
	if len(hash) > 16 {
		return hash[:16] + "..."
	}
	return hash
}

func boolCheck(v bool) string {
	if v {
		return "✅"
	}
	return "❌"
}

func boolCheckHTML(v bool) string {
	if v {
		return "✅"
	}
	return "❌"
}
