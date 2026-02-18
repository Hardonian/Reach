package errors

import (
	"strings"
	"testing"
)

func TestRedact(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"safe message", "safe message"},
		{"api_key=secret123456", "[REDACTED]"},
		{"API_KEY: secret123456", "[REDACTED]"},
		{"token: abcdefghijklmnop", "[REDACTED]"},
		{"secret=shhh", "[REDACTED]"},
		{"password: mypassword123", "[REDACTED]"},
		{"bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "[REDACTED]"},
		{"mongodb://user:pass@localhost/db", "[REDACTED]"},
		{"postgres://admin:secret@host/db", "[REDACTED]"},
		{"AKIAIOSFODNN7EXAMPLE", "[REDACTED]"},
		{"https://user:password@example.com", "[REDACTED]"},
	}
	
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := Redact(tt.input)
			if tt.expected == "[REDACTED]" {
				if got == tt.input {
					t.Errorf("Redact(%q) = %q, expected redacted", tt.input, got)
				}
				if !strings.Contains(got, "[REDACTED]") {
					t.Errorf("Redact(%q) = %q, expected to contain [REDACTED]", tt.input, got)
				}
			} else if got != tt.expected {
				t.Errorf("Redact(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestRedactMap(t *testing.T) {
	input := map[string]string{
		"safe_key":    "safe_value",
		"api_key":     "secret123456789012",
		"token":       "bearer_token_here_12345",
	}
	
	result := RedactMap(input)
	
	if result["safe_key"] != "safe_value" {
		t.Error("safe_key should not be redacted")
	}
	// Values should be redacted
	if result["api_key"] == "secret123456789012" {
		t.Error("api_key should be redacted")
	}
	if result["token"] == "bearer_token_here_12345" {
		t.Error("token should be redacted")
	}
}

func TestFormatSafe(t *testing.T) {
	if FormatSafe(nil) != "" {
		t.Error("FormatSafe(nil) should return empty string")
	}
	
	// Regular error
	regular := &testError{msg: "api_key=secret123"}
	safe := FormatSafe(regular)
	if strings.Contains(safe, "secret123") {
		t.Error("FormatSafe should redact secrets from regular errors")
	}
	
	// ReachError
	reachErr := New(CodePolicyDenied, "access denied")
	safe2 := FormatSafe(reachErr)
	if !strings.Contains(safe2, "POLICY_DENIED") {
		t.Error("FormatSafe should include code for ReachError")
	}
}

func TestFormatJSON(t *testing.T) {
	// nil error
	data, err := FormatJSON(nil)
	if err != nil {
		t.Fatalf("FormatJSON(nil) failed: %v", err)
	}
	if string(data) != "null" {
		t.Errorf("FormatJSON(nil) = %s, want null", string(data))
	}
	
	// ReachError
	reachErr := New(CodeExecutionFailed, "execution failed").
		WithContext("run_id", "run123")
	data, err = FormatJSON(reachErr)
	if err != nil {
		t.Fatalf("FormatJSON failed: %v", err)
	}
	if !strings.Contains(string(data), "EXECUTION_FAILED") {
		t.Error("JSON should contain error code")
	}
	
	// Regular error
	regular := &testError{msg: "something failed"}
	data, err = FormatJSON(regular)
	if err != nil {
		t.Fatalf("FormatJSON failed: %v", err)
	}
	if !strings.Contains(string(data), "UNKNOWN_ERROR") {
		t.Error("JSON should contain UNKNOWN_ERROR for regular errors")
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		s      string
		maxLen int
		want   string
	}{
		{"hello", 10, "hello"},
		{"hello world", 5, "he..."},
		{"hello", 3, "hel"},
		{"hello", 0, ""},
		{"", 10, ""},
	}
	
	for _, tt := range tests {
		got := Truncate(tt.s, tt.maxLen)
		if got != tt.want {
			t.Errorf("Truncate(%q, %d) = %q, want %q", tt.s, tt.maxLen, got, tt.want)
		}
	}
}

func TestSanitizeContextKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"valid_key", "valid_key"},
		{"key-with-hyphens", "key-with-hyphens"},
		{"key.with.dots", "key.with.dots"},
		{"key with spaces", "key_with_spaces"},
		{"key@special#chars", "key_special_chars"},
		{"UPPERCASE", "UPPERCASE"},
	}
	
	for _, tt := range tests {
		got := SanitizeContextKey(tt.input)
		if got != tt.expected {
			t.Errorf("SanitizeContextKey(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

// testError is a simple error implementation for testing
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
