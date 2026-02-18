package invariants

import (
	"errors"
	"sync/atomic"

	"reach/services/runner/internal/mesh"
	"reach/services/runner/internal/policy"
)

type ViolationReporter interface {
	RecordInvariantViolation(name string)
}

var violationReporter atomic.Value

func SetViolationReporter(reporter ViolationReporter) {
	violationReporter.Store(reporter)
}

func reportViolation(name string) {
	reporter, _ := violationReporter.Load().(ViolationReporter)
	if reporter != nil {
		reporter.RecordInvariantViolation(name)
	}
}

func PolicyGateRejectsUndeclaredTool(decision policy.Decision) bool {
	if decision.Allowed {
		return false
	}
	for _, reason := range decision.Reasons {
		if reason == policy.ReasonUndeclaredTool {
			return true
		}
	}
	return false
}

func DelegationRegistryHashPreserved(req mesh.DelegationRequest, expectedHash string) bool {
	return req.RegistryHash == expectedHash
}

func ReplaySnapshotMatches(expectedSnapshotHash, replaySnapshotHash string) error {
	if expectedSnapshotHash != replaySnapshotHash {
		reportViolation("replay_snapshot_hash_mismatch")
		return errors.New("replay snapshot hash mismatch")
	}
	return nil
}
