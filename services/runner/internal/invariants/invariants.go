package invariants

import (
	"errors"

	"reach/services/runner/internal/mesh"
	"reach/services/runner/internal/policy"
)

type ViolationReporter interface {
	RecordInvariantViolation(name string)
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
	return ReplaySnapshotMatchesWithReporter(expectedSnapshotHash, replaySnapshotHash, nil)
}

func ReplaySnapshotMatchesWithReporter(expectedSnapshotHash, replaySnapshotHash string, reporter ViolationReporter) error {
	if expectedSnapshotHash != replaySnapshotHash {
		if reporter != nil {
			reporter.RecordInvariantViolation("replay_snapshot_hash_mismatch")
		}
		return errors.New("replay snapshot hash mismatch")
	}
	return nil
}
