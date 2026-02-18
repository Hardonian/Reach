package telemetry

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"reach/services/runner/internal/errors"
)

func TestNewLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo)

	logger.Info("test message")

	output := buf.String()
	if !strings.Contains(output, "test message") {
		t.Errorf("expected log to contain 'test message', got: %s", output)
	}
	if !strings.Contains(output, "info") {
		t.Errorf("expected log to contain level 'info', got: %s", output)
	}
}

func TestLogLevels(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelWarn)

	// Debug should not be logged
	logger.Debug("debug message")
	if buf.Len() > 0 {
		t.Error("debug message should not be logged at warn level")
	}

	// Warn should be logged
	logger.Warn("warn message")
	if !strings.Contains(buf.String(), "warn message") {
		t.Error("warn message should be logged")
	}

	// Error should be logged
	buf.Reset()
	logger.Error("error message", nil)
	if !strings.Contains(buf.String(), "error message") {
		t.Error("error message should be logged")
	}
}

func TestLoggerWithComponent(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo).WithComponent("test-component")

	logger.Info("test")

	var entry LogEntry
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to unmarshal log entry: %v", err)
	}

	if entry.Component != "test-component" {
		t.Errorf("expected component 'test-component', got: %s", entry.Component)
	}
}

func TestLoggerWithField(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo).WithField("key", "value")

	logger.Info("test")

	var entry LogEntry
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to unmarshal log entry: %v", err)
	}

	if entry.Fields["key"] != "value" {
		t.Errorf("expected field key='value', got: %s", entry.Fields["key"])
	}
}

func TestLoggerWithError(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo)

	testErr := errors.New(errors.CodePolicyDenied, "access denied")
	logger.Error("operation failed", testErr)

	var entry LogEntry
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to unmarshal log entry: %v", err)
	}

	if entry.Error == "" {
		t.Error("expected error field to be set")
	}
	if entry.ErrorCode != string(errors.CodePolicyDenied) {
		t.Errorf("expected error code '%s', got: %s", errors.CodePolicyDenied, entry.ErrorCode)
	}
}

func TestLoggerRedaction(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo)

	logger.WithField("api_key", "secret123456789").Info("test")

	output := buf.String()
	if strings.Contains(output, "secret123456789") {
		t.Error("log should redact secrets")
	}
}

func TestLogBuilder(t *testing.T) {
	var buf bytes.Buffer
	logger := NewLogger(&buf, LevelInfo)

	testErr := errors.New(errors.CodeExecutionFailed, "execution failed")
	logger.WithError(testErr).
		WithField("run_id", "run123").
		Error("run failed")

	var entry LogEntry
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to unmarshal log entry: %v", err)
	}

	if entry.Error == "" {
		t.Error("expected error to be set")
	}
	if entry.Fields["run_id"] != "run123" {
		t.Errorf("expected run_id field")
	}
}

func TestLogEntryJSON(t *testing.T) {
	entry := LogEntry{
		Level:   LevelInfo,
		Message: "test",
	}

	data, err := json.Marshal(entry)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var parsed LogEntry
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if parsed.Message != "test" {
		t.Errorf("expected message 'test', got: %s", parsed.Message)
	}
}
