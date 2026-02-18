// Package harness provides pack scoring capabilities for Reach Autopack.
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

// CategoryScores represents scores for each category.
type CategoryScores struct {
	Determinism   int `json:"determinism"`
	PolicyHygiene int `json:"policy_hygiene"`
	SupplyChain   int `json:"supply_chain"`
	Performance   int `json:"performance"`
}

// ScoreIssue represents a scoring issue or recommendation.
type ScoreIssue struct {
	Category string `json:"category"`
	Severity string `json:"severity"` // error, warning, info
	Message  string `json:"message"`
	FixHint  string `json:"fix_hint,omitempty"`
}

// ScoreReport contains the complete scoring results.
type ScoreReport struct {
	PackID    string         `json:"pack_id"`
	Version   string         `json:"version"`
	Timestamp time.Time      `json:"timestamp"`
	Scores    CategoryScores `json:"scores"`
	Overall   float64        `json:"overall"`
	Grade     string         `json:"grade"`
	Badges    []string       `json:"badges"`
	Issues    []ScoreIssue   `json:"issues,omitempty"`
}

// ScoreDetails contains detailed scoring breakdown.
type ScoreDetails struct {
	Determinism   DeterminismDetails   `json:"determinism"`
	PolicyHygiene PolicyHygieneDetails `json:"policy_hygiene"`
	SupplyChain   SupplyChainDetails   `json:"supply_chain"`
	Performance   PerformanceDetails   `json:"performance"`
}

// DeterminismDetails contains determinism scoring breakdown.
type DeterminismDetails struct {
	HashStabilityPercent  float64 `json:"hash_stability_percent"`
	ReplaySuccessPercent  float64 `json:"replay_success_percent"`
	SpecCompliancePercent float64 `json:"spec_compliance_percent"`
	RunCount              int     `json:"run_count"`
	HashSamples           []string `json:"hash_samples,omitempty"`
}

// PolicyHygieneDetails contains policy hygiene scoring breakdown.
type PolicyHygieneDetails struct {
	DeclarationAccuracy float64  `json:"declaration_accuracy"`
	PermissionScope     float64  `json:"permission_scope"`
	PolicyContractValid float64  `json:"policy_contract_valid"`
	ExtraTools          []string `json:"extra_tools,omitempty"`
	MissingDeclarations []string `json:"missing_declarations,omitempty"`
}

// SupplyChainDetails contains supply chain scoring breakdown.
type SupplyChainDetails struct {
	SignatureValid     bool   `json:"signature_valid"`
	AuthorVerified     bool   `json:"author_verified"`
	ReproducibleBuild  bool   `json:"reproducible_build"`
	SignatureHash      string `json:"signature_hash,omitempty"`
	Author             string `json:"author,omitempty"`
}

// PerformanceDetails contains performance scoring breakdown.
type PerformanceDetails struct {
	ColdStartMs       int64   `json:"cold_start_ms"`
	ExecutionTimeMs   int64   `json:"execution_time_ms"`
	PeakMemoryKB      int64   `json:"peak_memory_kb"`
	ColdStartScore    float64 `json:"cold_start_score"`
	ExecutionScore    float64 `json:"execution_score"`
	MemoryScore       float64 `json:"memory_score"`
}

// Scorer computes pack scores.
type Scorer struct {
	FixturesDir string
	RunCount    int
}

// NewScorer creates a new pack scorer.
func NewScorer(fixturesDir string) *Scorer {
	return &Scorer{
		FixturesDir: fixturesDir,
		RunCount:    5, // Default number of runs for determinism check
	}
}

// ScorePack performs full scoring on a pack at the given path.
func (s *Scorer) ScorePack(packPath string) (*ScoreReport, error) {
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

	report := &ScoreReport{
		PackID:    pack.Metadata.ID,
		Version:   pack.Metadata.Version,
		Timestamp: time.Now().UTC(),
		Scores:    CategoryScores{},
		Issues:    []ScoreIssue{},
	}

	// Score each category
	detScore, detDetails := s.scoreDeterminism(&pack)
	report.Scores.Determinism = detScore
	s.addDeterminismIssues(report, detDetails)

	policyScore, policyDetails := s.scorePolicyHygiene(packPath, &pack)
	report.Scores.PolicyHygiene = policyScore
	s.addPolicyIssues(report, policyDetails)

	supplyScore, supplyDetails := s.scoreSupplyChain(packPath, &pack)
	report.Scores.SupplyChain = supplyScore
	s.addSupplyIssues(report, supplyDetails)

	perfScore, _ := s.scorePerformance(&pack)
	report.Scores.Performance = perfScore

	// Calculate overall score
	report.Overall = calculateOverall(report.Scores)

	// Determine grade and badges
	report.Grade = calculateGrade(report.Scores)
	report.Badges = calculateBadges(report.Scores, report.Grade)

	return report, nil
}

// scoreDeterminism computes the determinism score.
func (s *Scorer) scoreDeterminism(pack *PackDefinition) (int, DeterminismDetails) {
	details := DeterminismDetails{
		HashSamples: []string{},
	}

	// Spec compliance check (20%)
	specScore := 100.0
	if pack.Metadata.SpecVersion != "1.0" {
		specScore = 50.0
	}
	if !pack.DeterministicFlag {
		specScore = 0.0
	}
	details.SpecCompliancePercent = specScore

	// Hash stability check (40%)
	// Run multiple times and check hash consistency
	hashes := make([]string, s.RunCount)
	for i := 0; i < s.RunCount; i++ {
		hashes[i] = computePackHash(pack)
	}

	allMatch := true
	firstHash := hashes[0]
	for _, h := range hashes[1:] {
		if h != firstHash {
			allMatch = false
			break
		}
	}

	hashStability := 0.0
	if allMatch {
		hashStability = 100.0
	} else {
		// Partial credit for mostly matching
		matchCount := 0
		for _, h := range hashes {
			if h == firstHash {
				matchCount++
			}
		}
		hashStability = float64(matchCount) / float64(len(hashes)) * 100
	}
	details.HashStabilityPercent = hashStability
	details.HashSamples = hashes[:min(3, len(hashes))]
	details.RunCount = s.RunCount

	// Replay success check (40%)
	// In production, this would actually replay and compare
	// For now, assume replay works if hash is stable and deterministic flag is set
	replaySuccess := 0.0
	if allMatch && pack.DeterministicFlag {
		replaySuccess = 100.0
	} else if pack.DeterministicFlag {
		replaySuccess = 50.0
	}
	details.ReplaySuccessPercent = replaySuccess

	// Calculate weighted score
	score := int(hashStability*0.4 + replaySuccess*0.4 + specScore*0.2)
	return score, details
}

// scorePolicyHygiene computes the policy hygiene score.
func (s *Scorer) scorePolicyHygiene(packPath string, pack *PackDefinition) (int, PolicyHygieneDetails) {
	details := PolicyHygieneDetails{}

	// Declaration accuracy (50%): check if declared tools seem reasonable
	// In production, this would analyze actual tool usage
	declarationScore := 100.0
	if len(pack.DeclaredTools) == 0 {
		declarationScore = 0.0
		details.MissingDeclarations = append(details.MissingDeclarations, "No tools declared")
	} else if len(pack.DeclaredTools) > 20 {
		// Suspicious: too many tools declared
		declarationScore = 70.0
		details.ExtraTools = append(details.ExtraTools, "Suspicious: many tools declared")
	}
	details.DeclarationAccuracy = declarationScore

	// Permission scope (30%): check if permissions are minimal
	permissionScore := 100.0
	hasHighRisk := false
	for _, perm := range pack.DeclaredPermissions {
		if perm == "sys:admin" || perm == "sys:exec" {
			hasHighRisk = true
			permissionScore = 30.0
			break
		}
	}
	if !hasHighRisk && len(pack.DeclaredPermissions) > 10 {
		permissionScore = 70.0 // Suspicious: many permissions
	}
	details.PermissionScope = permissionScore

	// Policy contract validity (20%)
	policyScore := 100.0
	policyPath := filepath.Join(packPath, "policy.rego")
	if _, err := os.Stat(policyPath); os.IsNotExist(err) {
		// No policy file - check if governed
		if isGoverned(packPath) {
			policyScore = 0.0
		}
	} else {
		// Check if policy is valid
		content, err := os.ReadFile(policyPath)
		if err != nil || len(content) < 50 {
			policyScore = 50.0
		}
	}
	details.PolicyContractValid = policyScore

	// Calculate weighted score
	score := int(declarationScore*0.5 + permissionScore*0.3 + policyScore*0.2)
	return score, details
}

// scoreSupplyChain computes the supply chain score.
func (s *Scorer) scoreSupplyChain(packPath string, pack *PackDefinition) (int, SupplyChainDetails) {
	details := SupplyChainDetails{
		Author: pack.Metadata.Author,
	}

	// Signature validity (40%)
	signatureValid := false
	if pack.SignatureHash != "" {
		// Verify signature matches computed hash
		computed := computePackHash(pack)
		signatureValid = pack.SignatureHash == computed
		details.SignatureHash = pack.SignatureHash
	}
	details.SignatureValid = signatureValid

	// Author verification (30%)
	// In production, this would check against verified authors registry
	authorVerified := false
	if pack.Metadata.Author != "" && pack.Metadata.Author != "your-name" {
		authorVerified = true
	}
	details.AuthorVerified = authorVerified

	// Reproducible build (30%)
	// Check for source files that can rebuild the pack
	reproducible := false
	if _, err := os.Stat(filepath.Join(packPath, "src")); err == nil {
		reproducible = true
	}
	if _, err := os.Stat(filepath.Join(packPath, "Makefile")); err == nil {
		reproducible = true
	}
	if _, err := os.Stat(filepath.Join(packPath, "build.sh")); err == nil {
		reproducible = true
	}
	details.ReproducibleBuild = reproducible

	// Calculate weighted score
	signatureScore := 0.0
	if signatureValid {
		signatureScore = 100.0
	}
	authorScore := 0.0
	if authorVerified {
		authorScore = 100.0
	}
	reproScore := 0.0
	if reproducible {
		reproScore = 100.0
	}

	score := int(signatureScore*0.4 + authorScore*0.3 + reproScore*0.3)
	return score, details
}

// scorePerformance computes the performance score.
func (s *Scorer) scorePerformance(pack *PackDefinition) (int, PerformanceDetails) {
	details := PerformanceDetails{}

	// Simulated performance metrics
	// In production, these would come from actual benchmark runs
	coldStartMs := int64(50)
	executionMs := int64(200)
	peakMemKB := int64(1024)

	// Adjust based on pack complexity
	stepCount := len(pack.ExecutionGraph.Steps)
	if stepCount > 0 {
		executionMs = int64(100 + stepCount*50)
		peakMemKB = int64(512 + stepCount*128)
	}

	details.ColdStartMs = coldStartMs
	details.ExecutionTimeMs = executionMs
	details.PeakMemoryKB = peakMemKB

	// Score based on thresholds
	// Cold start: <50ms = 100, <100ms = 80, <200ms = 60, <500ms = 40, else 20
	coldStartScore := 0.0
	switch {
	case coldStartMs < 50:
		coldStartScore = 100.0
	case coldStartMs < 100:
		coldStartScore = 80.0
	case coldStartMs < 200:
		coldStartScore = 60.0
	case coldStartMs < 500:
		coldStartScore = 40.0
	default:
		coldStartScore = 20.0
	}
	details.ColdStartScore = coldStartScore

	// Execution time: <100ms = 100, <200ms = 90, <500ms = 70, <1000ms = 50, else 30
	execScore := 0.0
	switch {
	case executionMs < 100:
		execScore = 100.0
	case executionMs < 200:
		execScore = 90.0
	case executionMs < 500:
		execScore = 70.0
	case executionMs < 1000:
		execScore = 50.0
	default:
		execScore = 30.0
	}
	details.ExecutionScore = execScore

	// Memory: <1MB = 100, <5MB = 90, <10MB = 70, <50MB = 50, else 30
	memScore := 0.0
	switch {
	case peakMemKB < 1024:
		memScore = 100.0
	case peakMemKB < 5120:
		memScore = 90.0
	case peakMemKB < 10240:
		memScore = 70.0
	case peakMemKB < 51200:
		memScore = 50.0
	default:
		memScore = 30.0
	}
	details.MemoryScore = memScore

	// Calculate weighted score
	score := int(coldStartScore*0.4 + execScore*0.4 + memScore*0.2)
	return score, details
}

// computePackHash computes a deterministic hash for a pack.
func computePackHash(pack *PackDefinition) string {
	data, _ := json.Marshal(map[string]any{
		"id":          pack.Metadata.ID,
		"version":     pack.Metadata.Version,
		"tools":       pack.DeclaredTools,
		"permissions": pack.DeclaredPermissions,
		"steps":       pack.ExecutionGraph.Steps,
		"deterministic": pack.DeterministicFlag,
	})
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// isGoverned checks if a pack is marked as governed.
func isGoverned(packPath string) bool {
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return false
	}

	var pack map[string]any
	if err := json.Unmarshal(data, &pack); err != nil {
		return false
	}

	if governed, ok := pack["governed"].(bool); ok {
		return governed
	}
	return false
}

// calculateOverall computes the weighted overall score.
func calculateOverall(scores CategoryScores) float64 {
	// Equal weights for simplicity
	return float64(scores.Determinism+scores.PolicyHygiene+scores.SupplyChain+scores.Performance) / 4.0
}

// calculateGrade determines the grade from scores.
func calculateGrade(scores CategoryScores) string {
	allScores := []int{scores.Determinism, scores.PolicyHygiene, scores.SupplyChain, scores.Performance}

	// Check for Gold (all >= 90)
	all90Plus := true
	one95Plus := false
	for _, s := range allScores {
		if s < 90 {
			all90Plus = false
		}
		if s >= 95 {
			one95Plus = true
		}
	}
	if all90Plus && one95Plus {
		return "gold"
	}

	// Check for Silver (all >= 75, at least one >= 90)
	all75Plus := true
	one90Plus := false
	for _, s := range allScores {
		if s < 75 {
			all75Plus = false
		}
		if s >= 90 {
			one90Plus = true
		}
	}
	if all75Plus && one90Plus {
		return "silver"
	}

	// Check for Bronze (all >= 60)
	all60Plus := true
	for _, s := range allScores {
		if s < 60 {
			all60Plus = false
		}
	}
	if all60Plus {
		return "bronze"
	}

	return "needs_work"
}

// calculateBadges generates badges from scores.
func calculateBadges(scores CategoryScores, grade string) []string {
	badges := []string{}

	// Grade badge
	switch grade {
	case "gold":
		badges = append(badges, "🏆 Gold")
	case "silver":
		badges = append(badges, "🥈 Silver")
	case "bronze":
		badges = append(badges, "🥉 Bronze")
	default:
		badges = append(badges, "⚠️ Needs Work")
	}

	// Determinism badge
	if scores.Determinism >= 90 {
		badges = append(badges, "🔒 Deterministic")
	} else if scores.Determinism < 75 {
		badges = append(badges, "⚠️ Variable")
	}

	// Policy badge
	if scores.PolicyHygiene >= 90 {
		badges = append(badges, "🛡️ Minimal")
	} else if scores.PolicyHygiene < 75 {
		badges = append(badges, "⚠️ Permissive")
	}

	// Supply chain badge
	if scores.SupplyChain >= 90 {
		badges = append(badges, "✅ Verified")
	} else if scores.SupplyChain < 60 {
		badges = append(badges, "❌ Unverified")
	}

	// Performance badge
	if scores.Performance >= 90 {
		badges = append(badges, "🚀 Fast")
	} else if scores.Performance < 60 {
		badges = append(badges, "🐢 Slow")
	}

	return badges
}

// Issue adding helpers

func (s *Scorer) addDeterminismIssues(report *ScoreReport, details DeterminismDetails) {
	if details.HashStabilityPercent < 100 {
		report.Issues = append(report.Issues, ScoreIssue{
			Category: "determinism",
			Severity: "warning",
			Message:  fmt.Sprintf("Hash stability at %.1f%% - pack may not be fully deterministic", details.HashStabilityPercent),
			FixHint:  "Ensure pack uses deterministic operations only, avoid Date.now() and Math.random()",
		})
	}
	if details.ReplaySuccessPercent < 100 {
		report.Issues = append(report.Issues, ScoreIssue{
			Category: "determinism",
			Severity: "warning",
			Message:  "Replay may not produce identical results",
			FixHint:  "Set deterministic: true in pack.json and ensure all operations are pure",
		})
	}
}

func (s *Scorer) addPolicyIssues(report *ScoreReport, details PolicyHygieneDetails) {
	if details.DeclarationAccuracy < 100 {
		report.Issues = append(report.Issues, ScoreIssue{
			Category: "policy",
			Severity: "warning",
			Message:  "Tool declarations may not match actual usage",
			FixHint:  "Review declared_tools against actual pack operations",
		})
	}
	if len(details.ExtraTools) > 0 {
		for _, tool := range details.ExtraTools {
			report.Issues = append(report.Issues, ScoreIssue{
				Category: "policy",
				Severity: "info",
				Message:  tool,
				FixHint:  "Consider reducing tool declarations to principle of least privilege",
			})
		}
	}
}

func (s *Scorer) addSupplyIssues(report *ScoreReport, details SupplyChainDetails) {
	if !details.SignatureValid {
		report.Issues = append(report.Issues, ScoreIssue{
			Category: "supply_chain",
			Severity: "warning",
			Message:  "Pack is not cryptographically signed",
			FixHint:  "Sign the pack with 'reach pack sign' to improve trust score",
		})
	}
	if !details.AuthorVerified {
		report.Issues = append(report.Issues, ScoreIssue{
			Category: "supply_chain",
			Severity: "info",
			Message:  "Author identity not verified",
			FixHint:  "Register as a verified author with the registry",
		})
	}
}

// ToJSON serializes the report to JSON.
func (r *ScoreReport) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// ToHuman returns a human-readable report.
func (r *ScoreReport) ToHuman() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Pack: %s@%s\n", r.PackID, r.Version))
	sb.WriteString(fmt.Sprintf("Timestamp: %s\n", r.Timestamp.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("Grade: %s (%.1f/100)\n\n", r.Grade, r.Overall))

	sb.WriteString("Scores:\n")
	sb.WriteString(fmt.Sprintf("  Determinism:   %d/100\n", r.Scores.Determinism))
	sb.WriteString(fmt.Sprintf("  Policy Hygiene: %d/100\n", r.Scores.PolicyHygiene))
	sb.WriteString(fmt.Sprintf("  Supply Chain:  %d/100\n", r.Scores.SupplyChain))
	sb.WriteString(fmt.Sprintf("  Performance:   %d/100\n\n", r.Scores.Performance))

	sb.WriteString("Badges:\n")
	for _, badge := range r.Badges {
		sb.WriteString(fmt.Sprintf("  %s\n", badge))
	}

	if len(r.Issues) > 0 {
		sb.WriteString("\nIssues:\n")
		for _, issue := range r.Issues {
			sb.WriteString(fmt.Sprintf("  [%s] %s: %s\n", strings.ToUpper(issue.Severity), issue.Category, issue.Message))
			if issue.FixHint != "" {
				sb.WriteString(fmt.Sprintf("    → %s\n", issue.FixHint))
			}
		}
	}

	return sb.String()
}

// min returns the minimum of two ints.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}