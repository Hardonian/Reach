package autonomous

import (
	"context"
	"fmt"

	"reach/services/runner/internal/registry"
	"reach/services/runner/internal/spec"
)

type InvariantReporter func(ctx context.Context, code, message string)

type PackExecutorOption func(*PackExecutor)

// PackExecutor wraps an Executor and enforces ExecutionPack constraints.
type PackExecutor struct {
	Delegate          Executor
	Pack              registry.ExecutionPack
	SnapshotHash      string
	invariantReporter InvariantReporter
}

func NewPackExecutor(delegate Executor, pack registry.ExecutionPack, opts ...PackExecutorOption) *PackExecutor {
	exec := &PackExecutor{Delegate: delegate, Pack: pack}
	for _, opt := range opts {
		if opt != nil {
			opt(exec)
		}
	}
	return exec
}

func WithSnapshotHash(hash string) PackExecutorOption {
	return func(e *PackExecutor) {
		e.SnapshotHash = hash
	}
}

func WithInvariantReporter(reporter InvariantReporter) PackExecutorOption {
	return func(e *PackExecutor) {
		e.invariantReporter = reporter
	}
}

func (e *PackExecutor) reportInvariant(ctx context.Context, code, message string) {
	if e.invariantReporter == nil {
		return
	}
	e.invariantReporter(ctx, code, message)
}

func (e *PackExecutor) Execute(ctx context.Context, envelope ExecutionEnvelope) (*ExecutionResult, error) {
	if envelope.Context.SpecVersion != "" && !spec.IsCompatible(envelope.Context.SpecVersion) {
		msg := fmt.Sprintf("execution context spec version %s is incompatible with runtime %s", envelope.Context.SpecVersion, spec.Version)
		e.reportInvariant(ctx, "SPEC_VERSION_INCOMPATIBLE", msg)
		return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusError, Error: &ExecutionError{Code: "SPEC_VERSION_INCOMPATIBLE", Message: msg}}, nil
	}

	if envelope.Context.PackID != "" && envelope.Context.PackID != e.Pack.Metadata.ID {
		msg := fmt.Sprintf("envelope pack %s does not match executor pack %s", envelope.Context.PackID, e.Pack.Metadata.ID)
		e.reportInvariant(ctx, "PACK_MISMATCH", msg)
		return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusFailure, Error: &ExecutionError{Code: "PACK_MISMATCH", Message: msg}}, nil
	}

	if !e.Pack.VerifyToolAllowed(envelope.ToolName) {
		msg := fmt.Sprintf("tool %s is not declared in execution pack %s", envelope.ToolName, e.Pack.Metadata.ID)
		e.reportInvariant(ctx, "TOOL_DENIED", msg)
		return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusError, Error: &ExecutionError{Code: "TOOL_DENIED", Message: msg}}, nil
	}

	for _, p := range envelope.Permissions {
		if !e.Pack.VerifyPermissionAllowed(p) {
			msg := fmt.Sprintf("permission %s is not declared in execution pack %s", p, e.Pack.Metadata.ID)
			e.reportInvariant(ctx, "PERMISSION_DENIED", msg)
			return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusError, Error: &ExecutionError{Code: "PERMISSION_DENIED", Message: msg}}, nil
		}
	}

	if envelope.Context.IsReplay {
		if envelope.Context.PackHash != "" && envelope.Context.PackHash != e.Pack.SignatureHash {
			msg := fmt.Sprintf("replay pack hash %s does not match loaded pack %s", envelope.Context.PackHash, e.Pack.SignatureHash)
			e.reportInvariant(ctx, "REPLAY_INTEGRITY_VIOLATION", msg)
			return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusError, Error: &ExecutionError{Code: "REPLAY_SNAPSHOT_MISMATCH", Message: msg}}, nil
		}
		if e.SnapshotHash != "" && envelope.Context.RegistrySnapshotHash != "" && envelope.Context.RegistrySnapshotHash != e.SnapshotHash {
			msg := fmt.Sprintf("replay snapshot hash %s does not match runtime snapshot %s", envelope.Context.RegistrySnapshotHash, e.SnapshotHash)
			e.reportInvariant(ctx, "REPLAY_SNAPSHOT_MISMATCH", msg)
			return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusError, Error: &ExecutionError{Code: "REPLAY_SNAPSHOT_MISMATCH", Message: msg}}, nil
		}
	}

	envelope.Context.PackID = e.Pack.Metadata.ID
	envelope.Context.PackVersion = e.Pack.Metadata.Version
	envelope.Context.SpecVersion = spec.Version

	return e.Delegate.Execute(ctx, envelope)
}
