package errors

import (
	"context"
	"errors"
	"net"
	"os"
	"syscall"
)

// Classify attempts to classify an unknown error into a ReachError.
// This is used at system boundaries to ensure all errors are typed.
func Classify(err error) *ReachError {
	if err == nil {
		return nil
	}

	// Already a ReachError
	if re, ok := err.(*ReachError); ok {
		return re
	}

	// Context errors
	if errors.Is(err, context.DeadlineExceeded) {
		return New(CodeTimeout, "operation timed out").WithCause(err)
	}
	if errors.Is(err, context.Canceled) {
		return New(CodeCancelled, "operation cancelled").WithCause(err)
	}

	// Network errors
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return New(CodeTimeout, "network timeout").WithCause(err).SetRetryable(true)
		}
		return New(CodeFederationNodeUnreachable, "network error").WithCause(err).SetRetryable(true)
	}

	// Syscall errors
	var syscallErr syscall.Errno
	if errors.As(err, &syscallErr) {
		switch syscallErr {
		case syscall.ECONNREFUSED:
			return New(CodeFederationNodeUnreachable, "connection refused").WithCause(err).SetRetryable(true)
		case syscall.ETIMEDOUT:
			return New(CodeTimeout, "connection timed out").WithCause(err).SetRetryable(true)
		case syscall.EWOULDBLOCK:
			return New(CodeTimeout, "operation would block").WithCause(err).SetRetryable(true)
		case syscall.EMFILE, syscall.ENFILE:
			return New(CodeResourceExhausted, "too many open files").WithCause(err)
		case syscall.ENOSPC:
			return New(CodeResourceExhausted, "no space left on device").WithCause(err)
		}
		// Check if it's a network-related error
		if syscallErr == syscall.ENETUNREACH || syscallErr == syscall.EHOSTUNREACH {
			return New(CodeFederationNodeUnreachable, "network unreachable").WithCause(err).SetRetryable(true)
		}
	}

	// File system errors
	if errors.Is(err, os.ErrNotExist) {
		return New(CodeStorageNotFound, "file not found").WithCause(err)
	}
	if errors.Is(err, os.ErrPermission) {
		return New(CodePolicyDenied, "permission denied").WithCause(err)
	}

	// Default: unknown error
	return New(CodeUnknown, "an unexpected error occurred").WithCause(err)
}

// MustClassify ensures an error is a ReachError, panicking on nil input if err is non-nil.
// Use this when you know err is non-nil and want to ensure it's classified.
func MustClassify(err error) *ReachError {
	if err == nil {
		return nil
	}
	return Classify(err)
}

// ClassifyWithCode classifies an error with a suggested default code.
// If the error can be classified more specifically, that takes precedence.
func ClassifyWithCode(err error, defaultCode Code) *ReachError {
	if err == nil {
		return nil
	}

	classified := Classify(err)
	if classified.Code == CodeUnknown {
		classified.Code = defaultCode
	}
	return classified
}
