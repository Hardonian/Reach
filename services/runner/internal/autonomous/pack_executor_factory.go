package autonomous

import (
	"reach/services/runner/internal/invariants"
	"reach/services/runner/internal/registry"
)

// PackExecutorOptions centralizes replay-related wiring for orchestration sites.
type PackExecutorOptions struct {
	ExpectedReplaySnapshotHash string
	InvariantReporter          invariants.ViolationReporter
}

// NewOrchestrationPackExecutor builds a PackExecutor with replay guard and invariant reporting hooks.
func NewOrchestrationPackExecutor(delegate Executor, pack registry.ExecutionPack, opts PackExecutorOptions) *PackExecutor {
	exec := NewPackExecutor(delegate, pack)
	if opts.ExpectedReplaySnapshotHash != "" {
		exec.WithReplaySnapshotHash(opts.ExpectedReplaySnapshotHash)
	}
	if opts.InvariantReporter != nil {
		exec.WithInvariantReporter(opts.InvariantReporter)
	}
	return exec
}
