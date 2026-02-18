package invariants

import (
	"errors"

	"reach/services/runner/internal/mesh"
	"reach/services/runner/internal/policy"
)

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
		return errors.New("replay snapshot hash mismatch")
	}
	return nil
}
