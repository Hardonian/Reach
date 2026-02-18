package errors

import (
	"encoding/json"
	"regexp"
	"strings"
)

// Sensitive patterns to redact from error messages and context.
// These are matched case-insensitively.
var sensitivePatterns = []*regexp.Regexp{
	// API keys and tokens
	regexp.MustCompile(`(?i)(api[_-]?key\s*[:=]?\s*)["']?[a-zA-Z0-9_\-]{8,}["']?`),
	regexp.MustCompile(`(?i)(bearer\s+)["']?[a-zA-Z0-9_\-\.]{10,}["']?`),
	regexp.MustCompile(`(?i)(token\s*[:=]?\s*)["']?[a-zA-Z0-9_\-]{8,}["']?`),
	regexp.MustCompile(`(?i)(secret\s*[:=]?\s*)["']?[a-zA-Z0-9_\-]{4,}["']?`),
	
	// Private keys
	regexp.MustCompile(`(?i)(private[_-]?key\s*[:=]\s*)["']?[a-zA-Z0-9+/=]{20,}["']?`),
	regexp.MustCompile(`(?i)(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)[^\-]+(-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----)`),
	
	// Passwords
	regexp.MustCompile(`(?i)(password\s*[:=]\s*)["']?[^\s"']+["']?`),
	regexp.MustCompile(`(?i)(passwd\s*[:=]\s*)["']?[^\s"']+["']?`),
	
	// Connection strings with credentials
	regexp.MustCompile(`(?i)(mongodb(\+srv)?://)[^\s"']+@[^\s"']+`),
	regexp.MustCompile(`(?i)(postgres(ql)?://)[^\s"']+@[^\s"']+`),
	regexp.MustCompile(`(?i)(mysql://)[^\s"']+@[^\s"']+`),
	regexp.MustCompile(`(?i)(redis://)[^\s"']+@[^\s"']+`),
	
	// AWS credentials
	regexp.MustCompile(`(?i)(AKIA[0-9A-Z]{16})`),
	regexp.MustCompile(`(?i)(aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*)["']?[a-zA-Z0-9/+=]{40}["']?`),
	
	// URLs with embedded credentials
	regexp.MustCompile(`(?i)(https?://)[a-zA-Z0-9_\-]+:[^@\s"']+@[^\s"']+`),
}

// Redact removes sensitive information from a string.
// It replaces matches with [REDACTED].
func Redact(s string) string {
	if s == "" {
		return s
	}
	result := s
	for _, pattern := range sensitivePatterns {
		result = pattern.ReplaceAllString(result, "[REDACTED]")
	}
	return result
}

// RedactMap redacts all values in a map.
func RedactMap(m map[string]string) map[string]string {
	if m == nil {
		return nil
	}
	result := make(map[string]string, len(m))
	for k, v := range m {
		result[k] = Redact(v)
	}
	return result
}

// FormatSafe returns a safe string representation of an error for logging.
// It redacts sensitive information and never includes internal details.
func FormatSafe(err error) string {
	if err == nil {
		return ""
	}

	// If it's a ReachError, use its safe representation
	if re, ok := err.(*ReachError); ok {
		return re.SafeError()
	}

	// Otherwise, redact the error message
	return Redact(err.Error())
}

// FormatJSON returns a JSON representation of the error, safe for logging.
func FormatJSON(err error) ([]byte, error) {
	if err == nil {
		return []byte("null"), nil
	}

	// If it's a ReachError, marshal it directly
	if re, ok := err.(*ReachError); ok {
		return json.Marshal(re)
	}

	// Otherwise, create a safe representation
	safe := map[string]interface{}{
		"code":    string(CodeUnknown),
		"message": Redact(err.Error()),
	}
	return json.Marshal(safe)
}

// FormatJSONString returns a JSON string representation, or empty string on error.
func FormatJSONString(err error) string {
	b, err := FormatJSON(err)
	if err != nil {
		return ""
	}
	return string(b)
}

// Truncate truncates a string to a maximum length, adding "..." if truncated.
func Truncate(s string, maxLen int) string {
	if maxLen <= 0 {
		return ""
	}
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

// SanitizeContextKey ensures a context key is safe for logging.
// It removes any potentially dangerous characters.
func SanitizeContextKey(key string) string {
	// Only allow alphanumeric, underscore, hyphen, and dot
	var result strings.Builder
	for _, r := range key {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' {
			result.WriteRune(r)
		} else {
			result.WriteRune('_')
		}
	}
	return result.String()
}
