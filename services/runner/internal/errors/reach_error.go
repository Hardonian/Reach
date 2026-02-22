package errors

import (
	"encoding/json"
	"fmt"
	"time"
)

// ReachError is the canonical error type for Reach.
// All errors thrown in core paths should be a ReachError.
type ReachError struct {
	// Code is the machine-readable error code (e.g., CodeUnknown).
	Code Code `json:"code"`

	// Message is a user-safe description (no secrets).
	Message string `json:"message"`

	// Suggestion is an actionable hint to resolve the error.
	Suggestion string `json:"suggestion,omitempty"`

	// Deterministic indicates if the error is deterministic (e.g., policy denial).
	Deterministic bool `json:"deterministic"`

	// Cause is the underlying error (optional, may contain internal details).
	Cause error `json:"-"`

	// Context contains redacted context fields for debugging.
	Context map[string]string `json:"context,omitempty"`

	// Timestamp is when the error occurred.
	Timestamp time.Time `json:"timestamp"`

	// Retryable indicates if retrying might succeed.
	Retryable bool `json:"retryable"`
}

// Error implements the error interface.
func (e *ReachError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s (Suggestion: %s): %v", e.Code, e.Message, e.Suggestion, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the cause for error chain inspection.
func (e *ReachError) Unwrap() error {
	return e.Cause
}

// WithCause adds a cause to the error.
func (e *ReachError) WithCause(cause error) *ReachError {
	e.Cause = cause
	return e
}

// WithSuggestion adds an actionable suggestion to the error.
func (e *ReachError) WithSuggestion(suggestion string) *ReachError {
	e.Suggestion = suggestion
	return e
}

// WithDeterminism marks the error as deterministic or not.
func (e *ReachError) WithDeterminism(deterministic bool) *ReachError {
	e.Deterministic = deterministic
	return e
}

// WithContext adds context fields (will be redacted in logs).
func (e *ReachError) WithContext(key, value string) *ReachError {
	if e.Context == nil {
		e.Context = make(map[string]string)
	}
	e.Context[key] = Redact(value)
	return e
}

// WithContextMap adds multiple context fields.
func (e *ReachError) WithContextMap(ctx map[string]string) *ReachError {
	if e.Context == nil {
		e.Context = make(map[string]string)
	}
	for k, v := range ctx {
		e.Context[k] = Redact(v)
	}
	return e
}

// SetRetryable marks the error as retryable or not.
func (e *ReachError) SetRetryable(retryable bool) *ReachError {
	e.Retryable = retryable
	return e
}

// SafeError returns a safe string for logging (no internal details).
func (e *ReachError) SafeError() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// MarshalJSON implements custom JSON marshaling for safe serialization.
func (e *ReachError) MarshalJSON() ([]byte, error) {
	type safeErr struct {
		Code          string            `json:"code"`
		Category      string            `json:"category"`
		Message       string            `json:"message"`
		Suggestion    string            `json:"suggestion,omitempty"`
		Deterministic bool              `json:"deterministic"`
		Context       map[string]string `json:"context,omitempty"`
		Timestamp     time.Time         `json:"timestamp"`
		Retryable     bool              `json:"retryable"`
	}
	return json.Marshal(safeErr{
		Code:          string(e.Code),
		Category:      e.Code.Category(),
		Message:       e.Message,
		Suggestion:    e.Suggestion,
		Deterministic: e.Deterministic,
		Context:       e.Context,
		Timestamp:     e.Timestamp,
		Retryable:     e.Retryable,
	})
}

// New creates a new ReachError with the given code and message.
func New(code Code, message string) *ReachError {
	return &ReachError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now().UTC(),
		Retryable: code.IsRetryable(),
	}
}

// Newf creates a new ReachError with formatted message.
func Newf(code Code, format string, args ...interface{}) *ReachError {
	return New(code, fmt.Sprintf(format, args...))
}

// Wrap wraps an existing error with a ReachError.
// If the error is already a ReachError, it returns it as-is.
func Wrap(err error, code Code, message string) *ReachError {
	if err == nil {
		return nil
	}
	if re, ok := err.(*ReachError); ok {
		return re
	}
	return New(code, message).WithCause(err)
}

// Wrapf wraps an existing error with a formatted message.
func Wrapf(err error, code Code, format string, args ...interface{}) *ReachError {
	return Wrap(err, code, fmt.Sprintf(format, args...))
}

// IsReachError checks if an error is a ReachError.
func IsReachError(err error) bool {
	if err == nil {
		return false
	}
	_, ok := err.(*ReachError)
	return ok
}

// GetCode extracts the code from an error, or returns CodeUnknown.
func GetCode(err error) Code {
	if err == nil {
		return ""
	}
	if re, ok := err.(*ReachError); ok {
		return re.Code
	}
	return CodeUnknown
}

// IsRetryable checks if an error is retryable.
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	if re, ok := err.(*ReachError); ok {
		return re.Retryable
	}
	// Default: unknown errors are not retryable
	return false
}
