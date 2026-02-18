package autonomous

import (
	"context"
	"fmt"

	"reach/services/runner/internal/invariants"
	"reach/services/runner/internal/registry"
)

// PackExecutor wraps an Executor and enforces ExecutionPack constraints.
type PackExecutor struct {
	Delegate                   Executor
	Pack                       registry.ExecutionPack
	ExpectedReplaySnapshotHash string
	InvariantReporter          invariants.ViolationReporter
}

func NewPackExecutor(delegate Executor, pack registry.ExecutionPack) *PackExecutor {
	return &PackExecutor{
		Delegate: delegate,
		Pack:     pack,
	}
}

func (e *PackExecutor) WithReplaySnapshotHash(hash string) *PackExecutor {
	e.ExpectedReplaySnapshotHash = hash
	return e
}

func (e *PackExecutor) WithInvariantReporter(reporter invariants.ViolationReporter) *PackExecutor {
	e.InvariantReporter = reporter
	return e
}

func (e *PackExecutor) Execute(ctx context.Context, envelope ExecutionEnvelope) (*ExecutionResult, error) {
	// 1. Verify Pack Match (if envelope specifies a pack)
	// If envelope context specifies a pack, it must match the executor's loaded pack.
	// This ensures we aren't running mixed-pack sessions unless intended.
	if envelope.Context.PackID != "" && envelope.Context.PackID != e.Pack.Metadata.ID {
		return &ExecutionResult{
			EnvelopeID: envelope.ID,
			Status:     StatusFailure,
			Error: &ExecutionError{
				Code:    "PACK_MISMATCH",
				Message: fmt.Sprintf("envelope pack %s does not match executor pack %s", envelope.Context.PackID, e.Pack.Metadata.ID),
			},
		}, nil
	}

	// 2. Enforce Tool Allowlist
	if !e.Pack.VerifyToolAllowed(envelope.ToolName) {
		return &ExecutionResult{
			EnvelopeID: envelope.ID,
			Status:     StatusError, // Hard error, security violation
			Error: &ExecutionError{
				Code:    "TOOL_DENIED",
				Message: fmt.Sprintf("tool %s is not declared in execution pack %s", envelope.ToolName, e.Pack.Metadata.ID),
			},
		}, nil
	}

	// 3. (Optional) Enforce Permissions
	// The envelope comes with requested permissions. We should check if they are allowed by the pack.
	// However, usually the *tool* implies permissions, which the registry handles.
	// Here we check if the *requested* permissions in the envelope are within the pack's declared set.
	for _, p := range envelope.Permissions {
		if !e.Pack.VerifyPermissionAllowed(p) {
			return &ExecutionResult{
				EnvelopeID: envelope.ID,
				Status:     StatusError,
				Error: &ExecutionError{
					Code:    "PERMISSION_DENIED",
					Message: fmt.Sprintf("permission %s is not declared in execution pack %s", p, e.Pack.Metadata.ID),
				},
			}, nil
		}
	}

	// 4. Replay Integrity Check
	if envelope.Context.IsReplay {
		if envelope.Context.PackHash != "" && envelope.Context.PackHash != e.Pack.SignatureHash {
			return &ExecutionResult{
				EnvelopeID: envelope.ID,
				Status:     StatusError,
				Error: &ExecutionError{
					Code:    "REPLAY_INTEGRITY_VIOLATION",
					Message: fmt.Sprintf("replay pack hash %s does not match loaded pack %s", envelope.Context.PackHash, e.Pack.SignatureHash),
				},
			}, nil
		}
		if e.ExpectedReplaySnapshotHash != "" {
			if err := invariants.ReplaySnapshotMatchesWithReporter(e.ExpectedReplaySnapshotHash, envelope.Context.RegistrySnapshotHash, e.InvariantReporter); err != nil {
				return &ExecutionResult{
					EnvelopeID: envelope.ID,
					Status:     StatusError,
					Error: &ExecutionError{
						Code:    "REPLAY_SNAPSHOT_MISMATCH",
						Message: err.Error(),
					},
				}, nil
			}
		}
	}

	// 4. Update Context with Pack Info for Downstream Audit
	envelope.Context.PackID = e.Pack.Metadata.ID
	envelope.Context.PackVersion = e.Pack.Metadata.Version
	// We don't necessarily calculate hash here every time, assumed already validated at construction.

	// 5. Delegate
	return e.Delegate.Execute(ctx, envelope)
}
