package federation

import "testing"

func TestTrustScoreDeterministic(t *testing.T) {
	s := ReputationSnapshot{DelegationsSucceeded: 9, DelegationsFailedByReason: map[string]int{"timeout": 1}, Latency: LatencySnapshot{P50MS: 120, P95MS: 400}}
	a := TrustScore(s)
	b := TrustScore(s)
	if a != b {
		t.Fatalf("expected deterministic score, got %d != %d", a, b)
	}
}

func TestQuarantineOnReplayMismatch(t *testing.T) {
	if !ShouldQuarantine(90, true, 30) {
		t.Fatal("expected replay mismatch quarantine")
	}
}

func TestSelectorExcludesIncompatible(t *testing.T) {
	cfg := SelectorConfig{EnableWeightedSelection: true, SpecVersion: "1.2.0", RegistrySnapshotHash: "abc", RequiredCapabilities: []string{"tool.exec"}}
	_, err := SelectCandidate(cfg, []Candidate{{NodeID: "bad", SpecVersion: "2.0.0", RegistrySnapshotHash: "abc", Capabilities: []string{"tool.exec"}}})
	if err == nil {
		t.Fatal("expected no eligible candidate")
	}
}
