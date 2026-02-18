package errors

import (
	"context"
	"errors"
	"os"
	"syscall"
	"testing"
)

func TestClassify(t *testing.T) {
	tests := []struct {
		name         string
		err          error
		expectedCode Code
		retryable    bool
	}{
		{
			name:         "nil error",
			err:          nil,
			expectedCode: "",
		},
		{
			name:         "already ReachError",
			err:          New(CodePolicyDenied, "denied"),
			expectedCode: CodePolicyDenied,
		},
		{
			name:         "context deadline exceeded",
			err:          context.DeadlineExceeded,
			expectedCode: CodeTimeout,
			retryable:    true,
		},
		{
			name:         "context cancelled",
			err:          context.Canceled,
			expectedCode: CodeCancelled,
		},
		{
			name:         "file not found",
			err:          os.ErrNotExist,
			expectedCode: CodeStorageNotFound,
		},
		{
			name:         "permission denied",
			err:          os.ErrPermission,
			expectedCode: CodePolicyDenied,
		},
		{
			name:         "unknown error",
			err:          errors.New("something weird"),
			expectedCode: CodeUnknown,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Classify(tt.err)
			if tt.err == nil {
				if got != nil {
					t.Error("expected nil for nil error")
				}
				return
			}
			if got.Code != tt.expectedCode {
				t.Errorf("Classify() code = %s, want %s", got.Code, tt.expectedCode)
			}
			if got.Retryable != tt.retryable {
				t.Errorf("Classify() retryable = %v, want %v", got.Retryable, tt.retryable)
			}
		})
	}
}

func TestClassifyNetworkErrors(t *testing.T) {
	// Test timeout error
	timeoutErr := &netError{timeout: true}
	classified := Classify(timeoutErr)
	if classified.Code != CodeTimeout {
		t.Errorf("expected CodeTimeout for network timeout, got %s", classified.Code)
	}
	if !classified.Retryable {
		t.Error("network timeout should be retryable")
	}
	
	// Test temporary error
	tempErr := &netError{temporary: true}
	classified = Classify(tempErr)
	if classified.Code != CodeFederationNodeUnreachable {
		t.Errorf("expected CodeFederationNodeUnreachable, got %s", classified.Code)
	}
	if !classified.Retryable {
		t.Error("temporary network error should be retryable")
	}
}

func TestClassifySyscallErrors(t *testing.T) {
	// Test common syscall errors that should be available on most platforms
	tests := []struct {
		name      string
		err       syscall.Errno
		expected  Code
		retryable bool
	}{
		{"connection_refused", syscall.ECONNREFUSED, CodeFederationNodeUnreachable, true},
		{"connection_timed_out", syscall.ETIMEDOUT, CodeTimeout, true},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			classified := Classify(tt.err)
			if classified.Code != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, classified.Code)
			}
			if classified.Retryable != tt.retryable {
				t.Errorf("retryable = %v, want %v", classified.Retryable, tt.retryable)
			}
		})
	}
	
	// Test that syscall errors are classified (platform-specific codes may vary)
	t.Run("syscall_classified", func(t *testing.T) {
		// Use a known syscall error
		classified := Classify(syscall.EWOULDBLOCK)
		if classified.Code == CodeUnknown {
			t.Error("syscall error should be classified, not unknown")
		}
	})
}

func TestMustClassify(t *testing.T) {
	if MustClassify(nil) != nil {
		t.Error("MustClassify(nil) should return nil")
	}
	
	err := errors.New("test")
	classified := MustClassify(err)
	if classified == nil {
		t.Fatal("MustClassify should return non-nil for non-nil error")
	}
	if classified.Code != CodeUnknown {
		t.Errorf("expected CodeUnknown, got %s", classified.Code)
	}
}

func TestClassifyWithCode(t *testing.T) {
	// Known error should use its own code
	err := context.DeadlineExceeded
	classified := ClassifyWithCode(err, CodeInternal)
	if classified.Code != CodeTimeout {
		t.Errorf("expected CodeTimeout for deadline exceeded, got %s", classified.Code)
	}
	
	// Unknown error should use default code
	err = errors.New("unknown")
	classified = ClassifyWithCode(err, CodeExecutionFailed)
	if classified.Code != CodeExecutionFailed {
		t.Errorf("expected CodeExecutionFailed, got %s", classified.Code)
	}
}

// netError is a test implementation of net.Error
type netError struct {
	timeout   bool
	temporary bool
}

func (e *netError) Error() string   { return "network error" }
func (e *netError) Timeout() bool   { return e.timeout }
func (e *netError) Temporary() bool { return e.temporary }
