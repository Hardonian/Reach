package contextkeys

import (
	"context"
	"testing"
)

func TestContextWithExecutionID(t *testing.T) {
	ctx := context.Background()
	
	// Test setting and getting execution ID
	ctx = ContextWithExecutionID(ctx, "exec-123")
	if got := ExecutionIDFromContext(ctx); got != "exec-123" {
		t.Errorf("ExecutionIDFromContext() = %v, want %v", got, "exec-123")
	}
	
	// Test empty context
	emptyCtx := context.Background()
	if got := ExecutionIDFromContext(emptyCtx); got != "" {
		t.Errorf("ExecutionIDFromContext() on empty context = %v, want empty string", got)
	}
}

func TestContextWithSessionID(t *testing.T) {
	ctx := context.Background()
	
	ctx = ContextWithSessionID(ctx, "session-456")
	if got := SessionIDFromContext(ctx); got != "session-456" {
		t.Errorf("SessionIDFromContext() = %v, want %v", got, "session-456")
	}
	
	emptyCtx := context.Background()
	if got := SessionIDFromContext(emptyCtx); got != "" {
		t.Errorf("SessionIDFromContext() on empty context = %v, want empty string", got)
	}
}

func TestContextWithCorrelationID(t *testing.T) {
	ctx := context.Background()
	
	ctx = ContextWithCorrelationID(ctx, "corr-789")
	if got := CorrelationIDFromContext(ctx); got != "corr-789" {
		t.Errorf("CorrelationIDFromContext() = %v, want %v", got, "corr-789")
	}
}

func TestContextWithTenantID(t *testing.T) {
	ctx := context.Background()
	
	ctx = ContextWithTenantID(ctx, "tenant-abc")
	if got := TenantIDFromContext(ctx); got != "tenant-abc" {
		t.Errorf("TenantIDFromContext() = %v, want %v", got, "tenant-abc")
	}
}

func TestContextWithUserID(t *testing.T) {
	ctx := context.Background()
	
	ctx = ContextWithUserID(ctx, "user-def")
	if got := UserIDFromContext(ctx); got != "user-def" {
		t.Errorf("UserIDFromContext() = %v, want %v", got, "user-def")
	}
}

func TestContextWithRequestID(t *testing.T) {
	ctx := context.Background()
	
	ctx = ContextWithRequestID(ctx, "req-xyz")
	if got := RequestIDFromContext(ctx); got != "req-xyz" {
		t.Errorf("RequestIDFromContext() = %v, want %v", got, "req-xyz")
	}
}

func TestGetTraceContext(t *testing.T) {
	ctx := context.Background()
	
	// Set multiple IDs
	ctx = ContextWithCorrelationID(ctx, "corr-123")
	ctx = ContextWithExecutionID(ctx, "exec-456")
	ctx = ContextWithSessionID(ctx, "session-789")
	ctx = ContextWithTenantID(ctx, "tenant-abc")
	ctx = ContextWithUserID(ctx, "user-def")
	ctx = ContextWithRequestID(ctx, "req-xyz")
	
	trace := GetTraceContext(ctx)
	
	if trace.CorrelationID != "corr-123" {
		t.Errorf("TraceContext.CorrelationID = %v, want %v", trace.CorrelationID, "corr-123")
	}
	if trace.ExecutionID != "exec-456" {
		t.Errorf("TraceContext.ExecutionID = %v, want %v", trace.ExecutionID, "exec-456")
	}
	if trace.SessionID != "session-789" {
		t.Errorf("TraceContext.SessionID = %v, want %v", trace.SessionID, "session-789")
	}
	if trace.TenantID != "tenant-abc" {
		t.Errorf("TraceContext.TenantID = %v, want %v", trace.TenantID, "tenant-abc")
	}
	if trace.UserID != "user-def" {
		t.Errorf("TraceContext.UserID = %v, want %v", trace.UserID, "user-def")
	}
	if trace.RequestID != "req-xyz" {
		t.Errorf("TraceContext.RequestID = %v, want %v", trace.RequestID, "req-xyz")
	}
}

func TestIsValidTraceContext(t *testing.T) {
	// Empty context should be invalid
	emptyCtx := context.Background()
	if IsValidTraceContext(emptyCtx) {
		t.Error("IsValidTraceContext() on empty context should be false")
	}
	
	// Context with correlation ID should be valid
	corrCtx := ContextWithCorrelationID(context.Background(), "corr-123")
	if !IsValidTraceContext(corrCtx) {
		t.Error("IsValidTraceContext() with correlation ID should be true")
	}
	
	// Context with execution ID should be valid
	execCtx := ContextWithExecutionID(context.Background(), "exec-456")
	if !IsValidTraceContext(execCtx) {
		t.Error("IsValidTraceContext() with execution ID should be true")
	}
	
	// Context with both should be valid
	bothCtx := ContextWithExecutionID(ContextWithCorrelationID(context.Background(), "corr-123"), "exec-456")
	if !IsValidTraceContext(bothCtx) {
		t.Error("IsValidTraceContext() with both IDs should be true")
	}
}

func TestChainedContext(t *testing.T) {
	// Test that we can chain multiple context values
	ctx := context.Background()
	ctx = ContextWithCorrelationID(ctx, "corr-123")
	ctx = ContextWithExecutionID(ctx, "exec-456")
	ctx = ContextWithSessionID(ctx, "session-789")
	
	// All values should be retrievable
	if CorrelationIDFromContext(ctx) != "corr-123" {
		t.Error("CorrelationID lost in chained context")
	}
	if ExecutionIDFromContext(ctx) != "exec-456" {
		t.Error("ExecutionID lost in chained context")
	}
	if SessionIDFromContext(ctx) != "session-789" {
		t.Error("SessionID lost in chained context")
	}
}
