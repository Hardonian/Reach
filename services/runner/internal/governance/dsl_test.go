package governance_test

import (
	"strings"
	"testing"

	"reach/services/runner/internal/governance"
)

func TestDefaultPolicy(t *testing.T) {
	p := governance.DefaultPolicy()
	if p.Version != governance.PolicyVersion {
		t.Errorf("expected version %d, got %d", governance.PolicyVersion, p.Version)
	}
	if p.RequireDeterministic {
		t.Error("default policy should not require deterministic")
	}
	if p.MinReproducibilityRate != 0 {
		t.Errorf("default min reproducibility should be 0, got %d", p.MinReproducibilityRate)
	}
}

func TestStrictPolicy(t *testing.T) {
	p := governance.StrictPolicy()
	if !p.RequireDeterministic {
		t.Error("strict policy must require deterministic")
	}
	if !p.RequireSigned {
		t.Error("strict policy must require signing")
	}
	if p.MinReproducibilityRate < 90 {
		t.Errorf("strict min reproducibility must be >= 90, got %d", p.MinReproducibilityRate)
	}
	if !p.ForbidChaosOnMain {
		t.Error("strict policy must forbid chaos on main")
	}
}

func TestParsePolicy_Valid(t *testing.T) {
	text := `
# Test policy
version = 1
require_deterministic = true
require_signed = false
max_external_dependencies = 3
require_plugin_pinned = true
min_reproducibility_rate = 90
forbid_chaos_on_main = true
`
	p, err := governance.ParsePolicy(text)
	if err != nil {
		t.Fatalf("ParsePolicy() unexpected error: %v", err)
	}
	if !p.RequireDeterministic {
		t.Error("expected require_deterministic = true")
	}
	if p.RequireSigned {
		t.Error("expected require_signed = false")
	}
	if p.MaxExternalDependencies != 3 {
		t.Errorf("expected max_external_dependencies = 3, got %d", p.MaxExternalDependencies)
	}
	if !p.RequirePluginPinned {
		t.Error("expected require_plugin_pinned = true")
	}
	if p.MinReproducibilityRate != 90 {
		t.Errorf("expected min_reproducibility_rate = 90, got %d", p.MinReproducibilityRate)
	}
	if !p.ForbidChaosOnMain {
		t.Error("expected forbid_chaos_on_main = true")
	}
}

func TestParsePolicy_InvalidLine(t *testing.T) {
	_, err := governance.ParsePolicy("this is not valid")
	if err == nil {
		t.Error("expected error for invalid policy line")
	}
}

func TestParsePolicy_InvalidBool(t *testing.T) {
	_, err := governance.ParsePolicy("require_deterministic = maybe")
	if err == nil {
		t.Error("expected error for invalid boolean")
	}
}

func TestParsePolicy_InvalidReproducibilityRate(t *testing.T) {
	_, err := governance.ParsePolicy("min_reproducibility_rate = 150")
	if err == nil {
		t.Error("expected error for out-of-range reproducibility rate")
	}
}

func TestEvaluate_AllPassing(t *testing.T) {
	p := governance.StrictPolicy()
	input := governance.EvaluationInput{
		RunID:                   "run-001",
		IsDeterministic:         true,
		IsSigned:                true,
		ExternalDependencyCount: 2,
		AllPluginsPinned:        true,
		ReproducibilityScore:    98,
		IsChaosMode:             false,
		Branch:                  "feature/test",
	}
	result := p.Evaluate(input)
	if !result.Allowed {
		t.Errorf("expected evaluation to pass, got violations: %v", result.Violations)
	}
}

func TestEvaluate_NotDeterministic(t *testing.T) {
	p, _ := governance.ParsePolicy("require_deterministic = true")
	input := governance.EvaluationInput{
		RunID:           "run-002",
		IsDeterministic: false,
	}
	result := p.Evaluate(input)
	if result.Allowed {
		t.Error("expected evaluation to fail for non-deterministic pack")
	}
	found := false
	for _, v := range result.Violations {
		if v.Code == governance.ViolationNotDeterministic {
			found = true
		}
	}
	if !found {
		t.Error("expected NOT_DETERMINISTIC violation")
	}
}

func TestEvaluate_TooManyDependencies(t *testing.T) {
	p, _ := governance.ParsePolicy("max_external_dependencies = 2")
	input := governance.EvaluationInput{
		RunID:                   "run-003",
		ExternalDependencyCount: 5,
	}
	result := p.Evaluate(input)
	if result.Allowed {
		t.Error("expected evaluation to fail for too many dependencies")
	}
	found := false
	for _, v := range result.Violations {
		if v.Code == governance.ViolationTooManyDependencies {
			found = true
		}
	}
	if !found {
		t.Error("expected TOO_MANY_EXTERNAL_DEPENDENCIES violation")
	}
}

func TestEvaluate_ChaosOnMain(t *testing.T) {
	p, _ := governance.ParsePolicy("forbid_chaos_on_main = true")
	input := governance.EvaluationInput{
		RunID:       "run-004",
		IsChaosMode: true,
		Branch:      "main",
	}
	result := p.Evaluate(input)
	if result.Allowed {
		t.Error("expected evaluation to fail for chaos on main")
	}
	found := false
	for _, v := range result.Violations {
		if v.Code == governance.ViolationChaosOnMain {
			found = true
		}
	}
	if !found {
		t.Error("expected CHAOS_ON_MAIN_BRANCH violation")
	}
}

func TestEvaluate_ChaosNotOnMain_Allowed(t *testing.T) {
	p, _ := governance.ParsePolicy("forbid_chaos_on_main = true")
	input := governance.EvaluationInput{
		RunID:       "run-005",
		IsChaosMode: true,
		Branch:      "feature/chaos-test",
	}
	result := p.Evaluate(input)
	if !result.Allowed {
		t.Errorf("expected chaos allowed on feature branch, got violations: %v", result.Violations)
	}
}

func TestEvaluate_LowReproducibility(t *testing.T) {
	p, _ := governance.ParsePolicy("min_reproducibility_rate = 90")
	input := governance.EvaluationInput{
		RunID:                "run-006",
		ReproducibilityScore: 75,
	}
	result := p.Evaluate(input)
	if result.Allowed {
		t.Error("expected evaluation to fail for low reproducibility")
	}
}

func TestPolicyFingerprint_Stable(t *testing.T) {
	text := "version = 1\nrequire_deterministic = true\n"
	p1, _ := governance.ParsePolicy(text)
	p2, _ := governance.ParsePolicy(text)
	if p1.Fingerprint() != p2.Fingerprint() {
		t.Error("policy fingerprint must be stable for identical text")
	}
}

func TestPolicyFingerprint_ChangesOnEdit(t *testing.T) {
	p1, _ := governance.ParsePolicy("require_deterministic = true\n")
	p2, _ := governance.ParsePolicy("require_deterministic = false\n")
	if p1.Fingerprint() == p2.Fingerprint() {
		t.Error("policy fingerprint must differ for different policies")
	}
}

func TestPolicySerialize_ContainsAllKeys(t *testing.T) {
	p := governance.StrictPolicy()
	text := p.Serialize()
	for _, key := range []string{
		"version", "require_deterministic", "require_signed",
		"max_external_dependencies", "require_plugin_pinned",
		"min_reproducibility_rate", "forbid_chaos_on_main",
	} {
		if !strings.Contains(text, key) {
			t.Errorf("serialized policy missing key %q", key)
		}
	}
}

func TestEvaluate_MultipleViolations_SummaryContainsCodes(t *testing.T) {
	p := governance.StrictPolicy()
	input := governance.EvaluationInput{
		RunID:                   "run-007",
		IsDeterministic:         false,
		IsSigned:                false,
		ExternalDependencyCount: 99,
		AllPluginsPinned:        false,
		ReproducibilityScore:    10,
		IsChaosMode:             true,
		Branch:                  "main",
	}
	result := p.Evaluate(input)
	if result.Allowed {
		t.Error("expected evaluation to fail for all violations")
	}
	if len(result.Violations) < 5 {
		t.Errorf("expected >= 5 violations, got %d", len(result.Violations))
	}
	if !strings.Contains(result.Summary, "NOT_DETERMINISTIC") {
		t.Error("summary should mention NOT_DETERMINISTIC")
	}
}
