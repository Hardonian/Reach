package errors

import (
	"errors"
	"strings"
	"testing"
)

func TestNew(t *testing.T) {
	err := New(CodePolicyDenied, "access denied")
	if err.Code != CodePolicyDenied {
		t.Errorf("expected code %s, got %s", CodePolicyDenied, err.Code)
	}
	if err.Message != "access denied" {
		t.Errorf("expected message 'access denied', got %s", err.Message)
	}
	if err.Retryable {
		t.Error("expected non-retryable error")
	}
}

func TestNewf(t *testing.T) {
	err := Newf(CodeExecutionFailed, "execution %d failed", 42)
	if err.Code != CodeExecutionFailed {
		t.Errorf("expected code %s, got %s", CodeExecutionFailed, err.Code)
	}
	if !strings.Contains(err.Message, "42") {
		t.Errorf("expected message to contain '42', got %s", err.Message)
	}
}

func TestWithCause(t *testing.T) {
	cause := errors.New("underlying error")
	err := New(CodeInternal, "something went wrong").WithCause(cause)
	
	if err.Cause != cause {
		t.Error("expected cause to be set")
	}
	if !strings.Contains(err.Error(), "underlying error") {
		t.Errorf("expected error to contain cause, got %s", err.Error())
	}
}

func TestWithContext(t *testing.T) {
	err := New(CodePolicyDenied, "access denied").
		WithContext("user_id", "user123").
		WithContext("resource", "pack_abc")
	
	if err.Context == nil {
		t.Fatal("expected context to be set")
	}
	if err.Context["user_id"] != "user123" {
		t.Errorf("expected user_id in context")
	}
}

func TestWrap(t *testing.T) {
	// Wrap a regular error
	original := errors.New("something failed")
	wrapped := Wrap(original, CodeExecutionFailed, "execution failed")
	
	if wrapped.Code != CodeExecutionFailed {
		t.Errorf("expected code %s, got %s", CodeExecutionFailed, wrapped.Code)
	}
	if wrapped.Cause != original {
		t.Error("expected cause to be original error")
	}
	
	// Wrap a ReachError (should return as-is)
	reachErr := New(CodePolicyDenied, "denied")
	wrapped2 := Wrap(reachErr, CodeInternal, "internal")
	if wrapped2 != reachErr {
		t.Error("wrapping ReachError should return same error")
	}
	
	// Wrap nil
	if Wrap(nil, CodeInternal, "test") != nil {
		t.Error("wrapping nil should return nil")
	}
}

func TestIsReachError(t *testing.T) {
	if IsReachError(nil) {
		t.Error("nil should not be a ReachError")
	}
	if IsReachError(errors.New("regular")) {
		t.Error("regular error should not be a ReachError")
	}
	if !IsReachError(New(CodeInternal, "reach error")) {
		t.Error("ReachError should be recognized")
	}
}

func TestGetCode(t *testing.T) {
	if GetCode(nil) != "" {
		t.Error("nil error should return empty code")
	}
	if GetCode(errors.New("regular")) != CodeUnknown {
		t.Error("regular error should return CodeUnknown")
	}
	if GetCode(New(CodePolicyDenied, "denied")) != CodePolicyDenied {
		t.Error("ReachError should return its code")
	}
}

func TestIsRetryable(t *testing.T) {
	if IsRetryable(nil) {
		t.Error("nil should not be retryable")
	}
	if IsRetryable(errors.New("regular")) {
		t.Error("regular error should not be retryable")
	}
	// Timeout is retryable
	if !IsRetryable(New(CodeTimeout, "timeout")) {
		t.Error("timeout should be retryable")
	}
	// Policy denied is not retryable
	if IsRetryable(New(CodePolicyDenied, "denied")) {
		t.Error("policy denied should not be retryable")
	}
}

func TestSafeError(t *testing.T) {
	cause := errors.New("sensitive details")
	err := New(CodeInternal, "something failed").WithCause(cause)
	
	safe := err.SafeError()
	if strings.Contains(safe, "sensitive") {
		t.Error("safe error should not contain cause details")
	}
	if !strings.Contains(safe, "INTERNAL_ERROR") {
		t.Error("safe error should contain code")
	}
}

func TestMarshalJSON(t *testing.T) {
	err := New(CodePolicyDenied, "access denied").
		WithContext("user", "testuser").
		SetRetryable(false)
	
	data, err2 := err.MarshalJSON()
	if err2 != nil {
		t.Fatalf("marshal failed: %v", err2)
	}
	
	// Should contain code and message
	if !strings.Contains(string(data), "POLICY_DENIED") {
		t.Error("JSON should contain code")
	}
	if !strings.Contains(string(data), "access denied") {
		t.Error("JSON should contain message")
	}
	// Should not contain cause (internal details)
	if strings.Contains(string(data), "Cause") {
		t.Error("JSON should not contain Cause field")
	}
}

func TestCodeCategory(t *testing.T) {
	tests := []struct {
		code     Code
		expected string
	}{
		{CodeUnknown, "general"},
		{CodeInternal, "general"},
		{CodeExecutionFailed, "execution"},
		{CodePolicyDenied, "policy"},
		{CodeSignatureInvalid, "signature"},
		{CodeRegistryNotFound, "registry"},
		{CodeFederationHandshakeFailed, "federation"},
		{CodeReplayMismatch, "replay"},
		{CodeConfigInvalid, "config"},
		{CodeStorageReadFailed, "storage"},
		{CodeSandboxCreateFailed, "sandbox"},
		{Code("custom"), "other"},
	}
	
	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			if got := tt.code.Category(); got != tt.expected {
				t.Errorf("Category() = %s, want %s", got, tt.expected)
			}
		})
	}
}

func TestCodeIsRetryable(t *testing.T) {
	retryableCodes := []Code{
		CodeTimeout,
		CodeFederationNodeUnreachable,
		CodeFederationDelegationFailed,
		CodeStorageReadFailed,
		CodeStorageWriteFailed,
		CodeResourceExhausted,
		CodeExecutionTimeout,
	}
	
	for _, code := range retryableCodes {
		if !code.IsRetryable() {
			t.Errorf("%s should be retryable", code)
		}
	}
	
	nonRetryableCodes := []Code{
		CodePolicyDenied,
		CodeSignatureInvalid,
		CodeInvalidArgument,
	}
	
	for _, code := range nonRetryableCodes {
		if code.IsRetryable() {
			t.Errorf("%s should not be retryable", code)
		}
	}
}
