// Package telemetry provides minimal structured telemetry for Reach.
// All telemetry is local-first with no external dependencies.
package telemetry

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"reach/services/runner/internal/errors"
)

// LogLevel represents the severity of a log entry.
type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
)

// LogEntry represents a structured log entry.
type LogEntry struct {
	Timestamp time.Time         `json:"ts"`
	Level     LogLevel          `json:"level"`
	Message   string            `json:"msg"`
	Component string            `json:"component,omitempty"`
	Error     string            `json:"error,omitempty"`
	ErrorCode string            `json:"error_code,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}

// Logger provides structured logging with redaction.
type Logger struct {
	mu        sync.Mutex
	writer    io.Writer
	level     LogLevel
	component string
	fields    map[string]string
}

// NewLogger creates a new logger.
func NewLogger(w io.Writer, level LogLevel) *Logger {
	if w == nil {
		w = os.Stderr
	}
	return &Logger{
		writer: w,
		level:  level,
		fields: make(map[string]string),
	}
}

// WithComponent returns a logger with a component name.
func (l *Logger) WithComponent(component string) *Logger {
	return &Logger{
		writer:    l.writer,
		level:     l.level,
		component: component,
		fields:    l.fields,
	}
}

// WithField returns a logger with an additional field.
func (l *Logger) WithField(key, value string) *Logger {
	newFields := make(map[string]string, len(l.fields)+1)
	for k, v := range l.fields {
		newFields[k] = v
	}
	newFields[key] = value
	return &Logger{
		writer:    l.writer,
		level:     l.level,
		component: l.component,
		fields:    newFields,
	}
}

// log writes a log entry at the specified level.
func (l *Logger) log(level LogLevel, msg string, err error, extra map[string]string) {
	if !l.shouldLog(level) {
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC(),
		Level:     level,
		Message:   errors.Redact(msg),
		Component: l.component,
		Fields:    make(map[string]string, len(l.fields)+len(extra)),
	}

	// Add logger fields
	for k, v := range l.fields {
		entry.Fields[k] = errors.Redact(v)
	}

	// Add extra fields
	for k, v := range extra {
		entry.Fields[k] = errors.Redact(v)
	}

	// Add error info if present
	if err != nil {
		entry.Error = errors.FormatSafe(err)
		if re, ok := err.(*errors.ReachError); ok {
			entry.ErrorCode = string(re.Code)
		}
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	data, _ := json.Marshal(entry)
	fmt.Fprintln(l.writer, string(data))
}

func (l *Logger) shouldLog(level LogLevel) bool {
	levels := map[LogLevel]int{
		LevelDebug: 0,
		LevelInfo:  1,
		LevelWarn:  2,
		LevelError: 3,
		LevelFatal: 4,
	}
	return levels[level] >= levels[l.level]
}

// Debug logs a debug message.
func (l *Logger) Debug(msg string) { l.log(LevelDebug, msg, nil, nil) }

// Debugf logs a formatted debug message.
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.log(LevelDebug, fmt.Sprintf(format, args...), nil, nil)
}

// Info logs an info message.
func (l *Logger) Info(msg string) { l.log(LevelInfo, msg, nil, nil) }

// Infof logs a formatted info message.
func (l *Logger) Infof(format string, args ...interface{}) {
	l.log(LevelInfo, fmt.Sprintf(format, args...), nil, nil)
}

// Warn logs a warning message.
func (l *Logger) Warn(msg string) { l.log(LevelWarn, msg, nil, nil) }

// Warnf logs a formatted warning message.
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.log(LevelWarn, fmt.Sprintf(format, args...), nil, nil)
}

// Error logs an error message.
func (l *Logger) Error(msg string, err error) { l.log(LevelError, msg, err, nil) }

// Errorf logs a formatted error message.
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.log(LevelError, fmt.Sprintf(format, args...), nil, nil)
}

// Fatal logs a fatal message and exits.
func (l *Logger) Fatal(msg string, err error) {
	l.log(LevelFatal, msg, err, nil)
	os.Exit(1)
}

// Fatalf logs a formatted fatal message and exits.
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.log(LevelFatal, fmt.Sprintf(format, args...), nil, nil)
	os.Exit(1)
}

// WithError logs with an error field.
func (l *Logger) WithError(err error) *LogBuilder {
	return &LogBuilder{logger: l, err: err}
}

// LogBuilder provides a fluent interface for logging with fields.
type LogBuilder struct {
	logger *Logger
	level  LogLevel
	msg    string
	err    error
	fields map[string]string
}

// WithField adds a field to the log entry.
func (b *LogBuilder) WithField(key, value string) *LogBuilder {
	if b.fields == nil {
		b.fields = make(map[string]string)
	}
	b.fields[key] = value
	return b
}

// Debug logs at debug level.
func (b *LogBuilder) Debug(msg string) {
	b.logger.log(LevelDebug, msg, b.err, b.fields)
}

// Info logs at info level.
func (b *LogBuilder) Info(msg string) {
	b.logger.log(LevelInfo, msg, b.err, b.fields)
}

// Warn logs at warn level.
func (b *LogBuilder) Warn(msg string) {
	b.logger.log(LevelWarn, msg, b.err, b.fields)
}

// Error logs at error level.
func (b *LogBuilder) Error(msg string) {
	b.logger.log(LevelError, msg, b.err, b.fields)
}

// Default logger instance.
var defaultLogger = NewLogger(os.Stderr, LevelInfo)

// SetDefaultLevel sets the default logger level from environment.
func SetDefaultLevel() {
	level := os.Getenv("REACH_LOG_LEVEL")
	switch level {
	case "debug":
		defaultLogger.level = LevelDebug
	case "info":
		defaultLogger.level = LevelInfo
	case "warn":
		defaultLogger.level = LevelWarn
	case "error":
		defaultLogger.level = LevelError
	case "fatal":
		defaultLogger.level = LevelFatal
	}
}

func init() {
	SetDefaultLevel()
}

// Default returns the default logger.
func Default() *Logger { return defaultLogger }

// L is a shorthand for Default().
func L() *Logger { return defaultLogger }

// LogFilePath returns the default log file path.
func LogFilePath() string {
	if dir := os.Getenv("REACH_LOG_DIR"); dir != "" {
		return filepath.Join(dir, "reach.log")
	}
	// Default to user's home directory
	home, _ := os.UserHomeDir()
	if home == "" {
		home = "."
	}
	return filepath.Join(home, ".reach", "logs", "reach.log")
}
