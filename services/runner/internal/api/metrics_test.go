package api

import (
	"strings"
	"testing"
)

func TestMetricsPrometheusIncludesInvariantViolations(t *testing.T) {
	m := newMetrics()
	m.RecordInvariantViolation("replay_snapshot_hash_mismatch")
	m.RecordInvariantViolation("replay_snapshot_hash_mismatch")

	out := m.prometheus()
	if !strings.Contains(out, "reach_invariant_violations_total") {
		t.Fatalf("expected invariant violations metric in output: %s", out)
	}
	if !strings.Contains(out, `reach_invariant_violations_total{name="replay_snapshot_hash_mismatch"} 2`) {
		t.Fatalf("expected mismatch counter to be exported, got: %s", out)
	}
}
