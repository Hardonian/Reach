package jobs

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AuditEntry struct {
	RunID     string         `json:"run_id"`
	RequestID string         `json:"request_id"`
	Timestamp time.Time      `json:"timestamp"`
	Type      string         `json:"type"`
	Payload   map[string]any `json:"payload"`
}

type AuditLogger interface {
	Append(entry AuditEntry) error
	List(runID string) ([]AuditEntry, error)
}

type FileAuditLogger struct {
	root string
	mu   sync.Mutex
}

func NewFileAuditLogger(root string) *FileAuditLogger {
	return &FileAuditLogger{root: root}
}

func (l *FileAuditLogger) Append(entry AuditEntry) error {
	if err := os.MkdirAll(l.root, 0o755); err != nil {
		return fmt.Errorf("create audit dir: %w", err)
	}

	path := filepath.Join(l.root, fmt.Sprintf("%s.audit.jsonl", entry.RunID))
	line, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("marshal audit entry: %w", err)
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open audit file: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(append(line, '\n')); err != nil {
		return fmt.Errorf("append audit entry: %w", err)
	}
	return nil
}

func (l *FileAuditLogger) List(runID string) ([]AuditEntry, error) {
	path := filepath.Join(l.root, fmt.Sprintf("%s.audit.jsonl", runID))
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return []AuditEntry{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open audit file: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	entries := make([]AuditEntry, 0)
	for scanner.Scan() {
		var entry AuditEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			return nil, fmt.Errorf("decode audit entry: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan audit file: %w", err)
	}
	return entries, nil
}
