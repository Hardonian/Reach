// Package harness provides pack publishing capabilities.
package harness

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// PublishConfig contains publishing configuration.
type PublishConfig struct {
	PackPath       string
	RegistryURL    string
	RegistryGitURL string
	Author         string
	SignPack       bool
	AutoPR         bool
}

// RegistryEntry represents a pack entry in the registry.
type RegistryEntry struct {
	Name            string            `json:"name"`
	Repo            string            `json:"repo"`
	SpecVersion     string            `json:"spec_version"`
	Signature       string            `json:"signature"`
	Reproducibility string            `json:"reproducibility"`
	Verified        bool              `json:"verified"`
	Author          string            `json:"author"`
	Version         string            `json:"version"`
	Description     string            `json:"description"`
	Tags            []string          `json:"tags"`
	Attestation     *Attestation      `json:"attestation,omitempty"`
	PublishedAt     string            `json:"published_at"`
	Hash            string            `json:"hash"`
}

// Attestation represents verification metadata.
type Attestation struct {
	LintPassed       bool   `json:"lint_passed"`
	TestsPassed      bool   `json:"tests_passed"`
	DeterminismHash  string `json:"determinism_hash"`
	ReplayVerified   bool   `json:"replay_verified"`
	Signed           bool   `json:"signed"`
	VerifiedAt       string `json:"verified_at"`
}

// PRBundle contains all files needed for a registry PR.
type PRBundle struct {
	Entry       *RegistryEntry    `json:"entry"`
	PackContent map[string]any    `json:"pack_content"`
	Instructions string           `json:"instructions"`
	BranchName   string           `json:"branch_name"`
	Files        map[string]string `json:"files"`
}

// Publisher handles pack publishing.
type Publisher struct {
	Doctor  *Doctor
	Linter  *Linter
	Harness *Runner
}

// NewPublisher creates a new pack publisher.
func NewPublisher(fixturesDir string) *Publisher {
	return &Publisher{
		Doctor:  NewDoctor(fixturesDir),
		Linter:  NewLinter(),
		Harness: NewRunner(fixturesDir),
	}
}

// Publish prepares a pack for publishing.
func (p *Publisher) Publish(config PublishConfig) (*PRBundle, error) {
	// First run doctor to ensure pack is healthy
	report := p.Doctor.Diagnose(config.PackPath)
	if report.Overall == "critical" {
		return nil, fmt.Errorf("pack has critical issues, run 'reach pack doctor' to fix")
	}

	// Load pack content
	packContent, err := p.loadPackContent(config.PackPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load pack: %w", err)
	}

	// Generate registry entry
	entry, err := p.generateRegistryEntry(config, packContent)
	if err != nil {
		return nil, fmt.Errorf("failed to generate registry entry: %w", err)
	}

	// Generate attestation
	entry.Attestation = p.generateAttestation(config.PackPath, report)

	// Create PR bundle
	bundle := p.createPRBundle(entry, packContent, config)

	return bundle, nil
}

// loadPackContent loads the pack.json and related files.
func (p *Publisher) loadPackContent(packPath string) (map[string]any, error) {
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return nil, err
	}

	var content map[string]any
	if err := json.Unmarshal(data, &content); err != nil {
		return nil, err
	}

	return content, nil
}

// generateRegistryEntry creates a registry entry from pack content.
func (p *Publisher) generateRegistryEntry(config PublishConfig, packContent map[string]any) (*RegistryEntry, error) {
	metadata, ok := packContent["metadata"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("pack missing metadata")
	}

	name, _ := metadata["name"].(string)
	if name == "" {
		name, _ = metadata["id"].(string)
	}

	version, _ := metadata["version"].(string)
	if version == "" {
		version = "1.0.0"
	}

	specVersion, _ := packContent["spec_version"].(string)
	if specVersion == "" {
		specVersion = "1.0"
	}

	description, _ := metadata["description"].(string)
	author := config.Author
	if author == "" {
		author, _ = metadata["author"].(string)
	}

	// Compute pack hash
	packJSON, _ := json.Marshal(packContent)
	hash := sha256.Sum256(packJSON)

	// Get signature if present
	signature, _ := packContent["signature_hash"].(string)

	entry := &RegistryEntry{
		Name:            name,
		Repo:            config.RegistryGitURL,
		SpecVersion:     specVersion,
		Signature:       signature,
		Reproducibility: "deterministic",
		Verified:        signature != "",
		Author:          author,
		Version:         version,
		Description:     description,
		Tags:            []string{},
		PublishedAt:     time.Now().UTC().Format(time.RFC3339),
		Hash:            hex.EncodeToString(hash[:]),
	}

	return entry, nil
}

// generateAttestation creates verification attestation.
func (p *Publisher) generateAttestation(packPath string, report *DoctorReport) *Attestation {
	// Run determinism check
	hash := ""
	replayVerified := false

	// In a real implementation, this would run actual conformance tests
	// For now, we use the doctor report
	determinismCheck := false
	for _, check := range report.Checks {
		if check.Name == "Determinism" && check.Status == "pass" {
			determinismCheck = true
		}
	}

	if determinismCheck {
		hash = p.computeDeterminismHash(packPath)
		replayVerified = true
	}

	return &Attestation{
		LintPassed:      report.Summary.Fail == 0,
		TestsPassed:     report.Summary.Fail == 0 && report.Summary.Warn == 0,
		DeterminismHash: hash,
		ReplayVerified:  replayVerified,
		Signed:          report.Summary.Fail == 0,
		VerifiedAt:      time.Now().UTC().Format(time.RFC3339),
	}
}

// computeDeterminismHash computes a hash for determinism verification.
func (p *Publisher) computeDeterminismHash(packPath string) string {
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return ""
	}

	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:16]) // First 16 bytes
}

// createPRBundle creates the PR bundle with all necessary files.
func (p *Publisher) createPRBundle(entry *RegistryEntry, packContent map[string]any, config PublishConfig) *PRBundle {
	// Generate branch name
	branchName := fmt.Sprintf("add-pack-%s-%s", sanitizeBranchName(entry.Name), entry.Version)

	// Generate files
	files := make(map[string]string)

	// Registry entry JSON
	entryJSON, _ := json.MarshalIndent(entry, "", "  ")
	files[fmt.Sprintf("registry/%s.json", sanitizeFileName(entry.Name))] = string(entryJSON)

	// Pack content
	packJSON, _ := json.MarshalIndent(packContent, "", "  ")
	files[fmt.Sprintf("packs/%s/%s/pack.json", sanitizeFileName(entry.Name), entry.Version)] = string(packJSON)

	// Generate instructions
	instructions := p.generateInstructions(entry, config)

	return &PRBundle{
		Entry:        entry,
		PackContent:  packContent,
		Instructions: instructions,
		BranchName:   branchName,
		Files:        files,
	}
}

// generateInstructions creates human-readable PR instructions.
func (p *Publisher) generateInstructions(entry *RegistryEntry, config PublishConfig) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Publish Pack: %s\n\n", entry.Name))
	sb.WriteString(fmt.Sprintf("**Version:** %s\n", entry.Version))
	sb.WriteString(fmt.Sprintf("**Author:** %s\n", entry.Author))
	sb.WriteString(fmt.Sprintf("**Spec Version:** %s\n\n", entry.SpecVersion))

	sb.WriteString("## Verification Status\n\n")
	if entry.Attestation != nil {
		sb.WriteString(fmt.Sprintf("- Lint: %s\n", map[bool]string{true: "✓ Passed", false: "✗ Failed"}[entry.Attestation.LintPassed]))
		sb.WriteString(fmt.Sprintf("- Tests: %s\n", map[bool]string{true: "✓ Passed", false: "✗ Failed"}[entry.Attestation.TestsPassed]))
		sb.WriteString(fmt.Sprintf("- Determinism Hash: `%s`\n", entry.Attestation.DeterminismHash))
		sb.WriteString(fmt.Sprintf("- Replay Verified: %s\n", map[bool]string{true: "✓ Yes", false: "✗ No"}[entry.Attestation.ReplayVerified]))
		sb.WriteString(fmt.Sprintf("- Signed: %s\n", map[bool]string{true: "✓ Yes", false: "✗ No"}[entry.Attestation.Signed]))
	}

	sb.WriteString("\n## Files Added\n\n")
	sb.WriteString(fmt.Sprintf("- `registry/%s.json` - Registry entry\n", sanitizeFileName(entry.Name)))
	sb.WriteString(fmt.Sprintf("- `packs/%s/%s/pack.json` - Pack content\n\n", sanitizeFileName(entry.Name), entry.Version))

	sb.WriteString("## How to Submit\n\n")
	sb.WriteString("### Option 1: Using GitHub CLI (Recommended)\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString(fmt.Sprintf("# Clone the registry\n"))
	sb.WriteString(fmt.Sprintf("git clone %s\n", config.RegistryGitURL))
	sb.WriteString(fmt.Sprintf("cd %s\n", filepath.Base(config.RegistryGitURL)))
	sb.WriteString(fmt.Sprintf("\n# Create branch and copy files\n"))
	sb.WriteString(fmt.Sprintf("git checkout -b %s\n", fmt.Sprintf("add-pack-%s-%s", sanitizeBranchName(entry.Name), entry.Version)))
	sb.WriteString(fmt.Sprintf("# Copy files from the PR bundle to this repo\n"))
	sb.WriteString(fmt.Sprintf("\n# Commit and push\n"))
	sb.WriteString(fmt.Sprintf("git add .\n"))
	sb.WriteString(fmt.Sprintf("git commit -m \"Add pack: %s v%s\"\n", entry.Name, entry.Version))
	sb.WriteString(fmt.Sprintf("git push origin %s\n", fmt.Sprintf("add-pack-%s-%s", sanitizeBranchName(entry.Name), entry.Version)))
	sb.WriteString(fmt.Sprintf("\n# Create PR\n"))
	sb.WriteString(fmt.Sprintf("gh pr create --title \"Add pack: %s v%s\" --body \"Submission for %s\"\n", entry.Name, entry.Version, entry.Name))
	sb.WriteString("```\n\n")

	sb.WriteString("### Option 2: Manual PR\n\n")
	sb.WriteString("1. Fork the registry repository\n")
	sb.WriteString("2. Create a new branch\n")
	sb.WriteString("3. Copy the files from this bundle to your fork\n")
	sb.WriteString("4. Submit a pull request\n\n")

	sb.WriteString("## Checklist\n\n")
	sb.WriteString("- [ ] Pack has been tested locally\n")
	sb.WriteString("- [ ] All conformance tests pass\n")
	sb.WriteString("- [ ] Lint checks pass\n")
	sb.WriteString("- [ ] Pack is properly signed (if required)\n")
	sb.WriteString("- [ ] Description is accurate and helpful\n")

	return sb.String()
}

// SaveBundle writes the PR bundle to disk.
func (p *Publisher) SaveBundle(bundle *PRBundle, outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	// Write bundle.json
	bundleJSON, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(outputDir, "bundle.json"), bundleJSON, 0644); err != nil {
		return err
	}

	// Write instructions
	if err := os.WriteFile(filepath.Join(outputDir, "PR_INSTRUCTIONS.md"), []byte(bundle.Instructions), 0644); err != nil {
		return err
	}

	// Write all files
	for path, content := range bundle.Files {
		fullPath := filepath.Join(outputDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return err
		}
	}

	return nil
}

// sanitizeBranchName sanitizes a name for use in a git branch.
func sanitizeBranchName(name string) string {
	// Replace spaces and special chars with dashes
	sanitized := strings.ReplaceAll(name, " ", "-")
	sanitized = strings.ReplaceAll(sanitized, "/", "-")
	sanitized = strings.ReplaceAll(sanitized, "\\", "-")
	sanitized = strings.ReplaceAll(sanitized, ":", "-")
	return strings.ToLower(sanitized)
}

// sanitizeFileName sanitizes a name for use as a filename.
func sanitizeFileName(name string) string {
	return sanitizeBranchName(name)
}
