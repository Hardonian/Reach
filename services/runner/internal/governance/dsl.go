// Package governance provides the Trust Policy DSL for Reach.
//
// The policy DSL replaces heuristic trust scoring with machine-enforceable
// governance rules that can be versioned, overridden per-project, and
// produce machine-readable evaluation results.
//
// Policy files are TOML-like key=value text (one rule per line).
// Example policy:
//
//	version = 1
//	require_deterministic = true
//	require_signed = false
//	max_external_dependencies = 5
//	require_plugin_pinned = true
//	min_reproducibility_rate = 95
//	forbid_chaos_on_main = true
package governance

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// PolicyVersion is the current schema version for policy files.
const PolicyVersion = 1

// Policy holds a parsed governance policy document.
type Policy struct {
	// Version is the policy schema version for forward compatibility.
	Version int `json:"version"`

	// RequireDeterministic fails runs whose packs do not declare deterministic: true.
	RequireDeterministic bool `json:"require_deterministic"`

	// RequireSigned fails runs whose packs have no valid signature.
	RequireSigned bool `json:"require_signed"`

	// MaxExternalDependencies is the maximum number of external (network) deps allowed.
	// 0 means unlimited; set to a positive value to enforce supply-chain hygiene.
	MaxExternalDependencies int `json:"max_external_dependencies"`

	// RequirePluginPinned requires all plugins to declare a pinned checksum.
	RequirePluginPinned bool `json:"require_plugin_pinned"`

	// MinReproducibilityRate is the minimum reproducibility score (0–100) required.
	// Runs with a reproducibility score below this threshold are denied.
	MinReproducibilityRate int `json:"min_reproducibility_rate"`

	// ForbidChaosOnMain prevents chaos-mode execution on the main branch.
	ForbidChaosOnMain bool `json:"forbid_chaos_on_main"`

	// source is the raw text used to compute the policy fingerprint.
	source string
}

// Fingerprint returns the SHA-256 hash of the policy source text.
// This ties policy evaluation results back to a specific policy version.
func (p *Policy) Fingerprint() string {
	h := sha256.Sum256([]byte(p.source))
	return hex.EncodeToString(h[:])
}

// DefaultPolicy returns a permissive policy suitable for OSS/local use.
// All governance checks default to their most permissive settings.
func DefaultPolicy() *Policy {
	p := &Policy{
		Version:                 PolicyVersion,
		RequireDeterministic:    false,
		RequireSigned:           false,
		MaxExternalDependencies: 0,
		RequirePluginPinned:     false,
		MinReproducibilityRate:  0,
		ForbidChaosOnMain:       false,
	}
	p.source = marshalPolicySource(p)
	return p
}

// StrictPolicy returns a production-grade policy with all safeguards enabled.
func StrictPolicy() *Policy {
	p := &Policy{
		Version:                 PolicyVersion,
		RequireDeterministic:    true,
		RequireSigned:           true,
		MaxExternalDependencies: 3,
		RequirePluginPinned:     true,
		MinReproducibilityRate:  95,
		ForbidChaosOnMain:       true,
	}
	p.source = marshalPolicySource(p)
	return p
}

// ParsePolicy parses a policy document from its text representation.
// The format is one directive per line:
//
//	key = value
//
// Lines beginning with # are comments and are ignored.
// Unknown keys are silently ignored for forward compatibility.
func ParsePolicy(text string) (*Policy, error) {
	p := DefaultPolicy()
	p.source = text

	scanner := bufio.NewScanner(strings.NewReader(text))
	lineNum := 0

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		lineNum++

		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("governance: line %d: invalid directive %q", lineNum, line)
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch key {
		case "version":
			v, err := strconv.Atoi(val)
			if err != nil {
				return nil, fmt.Errorf("governance: line %d: invalid version %q", lineNum, val)
			}
			p.Version = v

		case "require_deterministic":
			b, err := parseBool(val)
			if err != nil {
				return nil, fmt.Errorf("governance: line %d: %w", lineNum, err)
			}
			p.RequireDeterministic = b

		case "require_signed":
			b, err := parseBool(val)
			if err != nil {
				return nil, fmt.Errorf("governance: line %d: %w", lineNum, err)
			}
			p.RequireSigned = b

		case "max_external_dependencies":
			n, err := strconv.Atoi(val)
			if err != nil || n < 0 {
				return nil, fmt.Errorf("governance: line %d: invalid max_external_dependencies %q", lineNum, val)
			}
			p.MaxExternalDependencies = n

		case "require_plugin_pinned":
			b, err := parseBool(val)
			if err != nil {
				return nil, fmt.Errorf("governance: line %d: %w", lineNum, err)
			}
			p.RequirePluginPinned = b

		case "min_reproducibility_rate":
			n, err := strconv.Atoi(val)
			if err != nil || n < 0 || n > 100 {
				return nil, fmt.Errorf("governance: line %d: min_reproducibility_rate must be 0–100", lineNum)
			}
			p.MinReproducibilityRate = n

		case "forbid_chaos_on_main":
			b, err := parseBool(val)
			if err != nil {
				return nil, fmt.Errorf("governance: line %d: %w", lineNum, err)
			}
			p.ForbidChaosOnMain = b
		}
	}

	return p, nil
}

// LoadPolicy loads a policy from a file path.
// If the file does not exist, it returns the DefaultPolicy (permissive).
func LoadPolicy(path string) (*Policy, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return DefaultPolicy(), nil
	}
	if err != nil {
		return nil, fmt.Errorf("governance: cannot read policy file: %w", err)
	}
	return ParsePolicy(string(data))
}

// Serialize returns the canonical text representation of the policy.
func (p *Policy) Serialize() string {
	return marshalPolicySource(p)
}

// MarshalJSON implements json.Marshaler for consistency.
func (p *Policy) MarshalJSON() ([]byte, error) {
	type alias Policy
	return json.Marshal((*alias)(p))
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

// ViolationCode identifies a specific policy violation.
type ViolationCode string

const (
	ViolationNotDeterministic     ViolationCode = "NOT_DETERMINISTIC"
	ViolationNotSigned            ViolationCode = "NOT_SIGNED"
	ViolationTooManyDependencies  ViolationCode = "TOO_MANY_EXTERNAL_DEPENDENCIES"
	ViolationPluginNotPinned      ViolationCode = "PLUGIN_NOT_PINNED"
	ViolationReproducibilityLow   ViolationCode = "REPRODUCIBILITY_BELOW_MINIMUM"
	ViolationChaosOnMain          ViolationCode = "CHAOS_ON_MAIN_BRANCH"
)

// Violation is a single policy violation with a machine-readable code.
type Violation struct {
	Code    ViolationCode `json:"code"`
	Message string        `json:"message"`
	Field   string        `json:"field,omitempty"`
}

// EvaluationInput is the context provided to policy evaluation.
type EvaluationInput struct {
	// RunID is the run being evaluated.
	RunID string `json:"run_id"`

	// IsDeterministic is true if the pack declares deterministic behavior.
	IsDeterministic bool `json:"is_deterministic"`

	// IsSigned is true if the pack has a valid cryptographic signature.
	IsSigned bool `json:"is_signed"`

	// ExternalDependencyCount is the number of external (network) dependencies.
	ExternalDependencyCount int `json:"external_dependency_count"`

	// AllPluginsPinned is true if every plugin specifies a checksum.
	AllPluginsPinned bool `json:"all_plugins_pinned"`

	// ReproducibilityScore is the latest reproducibility score (0–100).
	// -1 means not yet measured.
	ReproducibilityScore int `json:"reproducibility_score"`

	// IsChaosMode is true if chaos mode is active for this run.
	IsChaosMode bool `json:"is_chaos_mode"`

	// Branch is the current git branch (used by forbid_chaos_on_main).
	Branch string `json:"branch,omitempty"`
}

// EvaluationResult is the outcome of evaluating a policy against a run.
type EvaluationResult struct {
	// RunID is the run that was evaluated.
	RunID string `json:"run_id"`

	// PolicyFingerprint is the SHA-256 of the policy text evaluated against.
	PolicyFingerprint string `json:"policy_fingerprint"`

	// Allowed is true if the run passes all policy rules.
	Allowed bool `json:"allowed"`

	// Violations lists all policy rules that were violated.
	Violations []Violation `json:"violations"`

	// Summary is a human-readable description of the result.
	Summary string `json:"summary"`
}

// Evaluate applies the policy to the given input and returns a result.
// Evaluation is deterministic: identical inputs produce identical results.
func (p *Policy) Evaluate(input EvaluationInput) EvaluationResult {
	var violations []Violation

	if p.RequireDeterministic && !input.IsDeterministic {
		violations = append(violations, Violation{
			Code:    ViolationNotDeterministic,
			Message: "Policy requires deterministic execution; pack does not declare deterministic: true",
			Field:   "is_deterministic",
		})
	}

	if p.RequireSigned && !input.IsSigned {
		violations = append(violations, Violation{
			Code:    ViolationNotSigned,
			Message: "Policy requires a valid cryptographic signature on the pack",
			Field:   "is_signed",
		})
	}

	if p.MaxExternalDependencies > 0 && input.ExternalDependencyCount > p.MaxExternalDependencies {
		violations = append(violations, Violation{
			Code: ViolationTooManyDependencies,
			Message: fmt.Sprintf(
				"Pack has %d external dependencies; policy allows at most %d",
				input.ExternalDependencyCount, p.MaxExternalDependencies,
			),
			Field: "external_dependency_count",
		})
	}

	if p.RequirePluginPinned && !input.AllPluginsPinned {
		violations = append(violations, Violation{
			Code:    ViolationPluginNotPinned,
			Message: "Policy requires all plugins to declare a pinned checksum",
			Field:   "all_plugins_pinned",
		})
	}

	if p.MinReproducibilityRate > 0 && input.ReproducibilityScore >= 0 &&
		input.ReproducibilityScore < p.MinReproducibilityRate {
		violations = append(violations, Violation{
			Code: ViolationReproducibilityLow,
			Message: fmt.Sprintf(
				"Reproducibility score %d%% is below policy minimum of %d%%",
				input.ReproducibilityScore, p.MinReproducibilityRate,
			),
			Field: "reproducibility_score",
		})
	}

	if p.ForbidChaosOnMain && input.IsChaosMode &&
		(input.Branch == "main" || input.Branch == "master") {
		violations = append(violations, Violation{
			Code:    ViolationChaosOnMain,
			Message: fmt.Sprintf("Policy forbids chaos mode on branch %q", input.Branch),
			Field:   "is_chaos_mode",
		})
	}

	allowed := len(violations) == 0
	summary := "Policy evaluation passed — all rules satisfied."
	if !allowed {
		codes := make([]string, 0, len(violations))
		for _, v := range violations {
			codes = append(codes, string(v.Code))
		}
		sort.Strings(codes)
		summary = fmt.Sprintf("Policy evaluation failed — violations: %s", strings.Join(codes, ", "))
	}

	return EvaluationResult{
		RunID:             input.RunID,
		PolicyFingerprint: p.Fingerprint(),
		Allowed:           allowed,
		Violations:        violations,
		Summary:           summary,
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func parseBool(s string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "true", "yes", "1":
		return true, nil
	case "false", "no", "0":
		return false, nil
	}
	return false, fmt.Errorf("invalid boolean value %q (expected true/false)", s)
}

// marshalPolicySource produces a canonical text serialization of a policy.
// Keys are always written in alphabetical order to ensure a stable fingerprint.
func marshalPolicySource(p *Policy) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("version = %d\n", p.Version))
	sb.WriteString(fmt.Sprintf("forbid_chaos_on_main = %v\n", p.ForbidChaosOnMain))
	sb.WriteString(fmt.Sprintf("max_external_dependencies = %d\n", p.MaxExternalDependencies))
	sb.WriteString(fmt.Sprintf("min_reproducibility_rate = %d\n", p.MinReproducibilityRate))
	sb.WriteString(fmt.Sprintf("require_deterministic = %v\n", p.RequireDeterministic))
	sb.WriteString(fmt.Sprintf("require_plugin_pinned = %v\n", p.RequirePluginPinned))
	sb.WriteString(fmt.Sprintf("require_signed = %v\n", p.RequireSigned))
	return sb.String()
}
