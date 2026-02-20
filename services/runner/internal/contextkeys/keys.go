// Package contextkeys provides standardized context key definitions for
// request-scoped values like correlation IDs, execution IDs, and session IDs.
package contextkeys

import "context"

// Key is the type for all context keys in this package to avoid collisions.
type Key string

const (
	// CorrelationIDKey is the context key for the request correlation ID.
	CorrelationIDKey Key = "correlation_id"
	
	// ExecutionIDKey is the context key for the current execution/run ID.
	ExecutionIDKey Key = "execution_id"
	
	// SessionIDKey is the context key for the user session ID.
	SessionIDKey Key = "session_id"
	
	// TenantIDKey is the context key for the tenant/organization ID.
	TenantIDKey Key = "tenant_id"
	
	// UserIDKey is the context key for the authenticated user ID.
	UserIDKey Key = "user_id"
	
	// RequestIDKey is the context key for the unique request ID.
	RequestIDKey Key = "request_id"
)

// ContextWithExecutionID returns a new context with the execution ID set.
func ContextWithExecutionID(ctx context.Context, executionID string) context.Context {
	return context.WithValue(ctx, ExecutionIDKey, executionID)
}

// ExecutionIDFromContext retrieves the execution ID from the context.
// Returns empty string if not found.
func ExecutionIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(ExecutionIDKey).(string); ok {
		return id
	}
	return ""
}

// ContextWithSessionID returns a new context with the session ID set.
func ContextWithSessionID(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, SessionIDKey, sessionID)
}

// SessionIDFromContext retrieves the session ID from the context.
// Returns empty string if not found.
func SessionIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(SessionIDKey).(string); ok {
		return id
	}
	return ""
}

// ContextWithCorrelationID returns a new context with the correlation ID set.
func ContextWithCorrelationID(ctx context.Context, correlationID string) context.Context {
	return context.WithValue(ctx, CorrelationIDKey, correlationID)
}

// CorrelationIDFromContext retrieves the correlation ID from the context.
// Returns empty string if not found.
func CorrelationIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(CorrelationIDKey).(string); ok {
		return id
	}
	return ""
}

// ContextWithTenantID returns a new context with the tenant ID set.
func ContextWithTenantID(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, TenantIDKey, tenantID)
}

// TenantIDFromContext retrieves the tenant ID from the context.
// Returns empty string if not found.
func TenantIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(TenantIDKey).(string); ok {
		return id
	}
	return ""
}

// ContextWithUserID returns a new context with the user ID set.
func ContextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

// UserIDFromContext retrieves the user ID from the context.
// Returns empty string if not found.
func UserIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

// TraceContext holds all trace identifiers for a request.
type TraceContext struct {
	CorrelationID string
	ExecutionID   string
	SessionID     string
	TenantID      string
	UserID        string
	RequestID     string
}

// GetTraceContext extracts all trace identifiers from a context.
func GetTraceContext(ctx context.Context) TraceContext {
	return TraceContext{
		CorrelationID: CorrelationIDFromContext(ctx),
		ExecutionID:   ExecutionIDFromContext(ctx),
		SessionID:     SessionIDFromContext(ctx),
		TenantID:      TenantIDFromContext(ctx),
		UserID:        UserIDFromContext(ctx),
		RequestID:     RequestIDFromContext(ctx),
	}
}

// RequestIDFromContext retrieves the request ID from the context.
// Returns empty string if not found.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	return ""
}

// ContextWithRequestID returns a new context with the request ID set.
func ContextWithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// IsValidTraceContext checks if the context has minimum required trace info.
// Requires at least correlation ID or execution ID.
func IsValidTraceContext(ctx context.Context) bool {
	return CorrelationIDFromContext(ctx) != "" || ExecutionIDFromContext(ctx) != ""
}
