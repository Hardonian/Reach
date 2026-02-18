package autonomous

import (
	"context"

	"reach/services/runner/internal/registry"
)

// NewOrchestrationPackExecutor centralizes runtime wiring for execution-pack enforcement
// so replay invariants are always validated with the same snapshot hash + reporter contract.
func NewOrchestrationPackExecutor(delegate Executor, pack registry.ExecutionPack, snapshotHash string, reporter InvariantReporter) Executor {
	return NewPackExecutor(
		delegate,
		pack,
		WithSnapshotHash(snapshotHash),
		WithInvariantReporter(reporter),
	)
}

func InvariantAuditReporter(audit func(context.Context, string, map[string]any)) InvariantReporter {
	return func(ctx context.Context, code, message string) {
		if audit == nil {
			return
		}
		audit(ctx, "orchestration.invariant_violation", map[string]any{
			"code":    code,
			"message": message,
		})
	}
}
