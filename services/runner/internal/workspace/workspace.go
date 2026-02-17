package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Manager struct {
	Root         string
	TTL          time.Duration
	MaxFileBytes int64
}

func NewManager(root string) *Manager {
	return &Manager{Root: root, TTL: time.Hour, MaxFileBytes: 1 << 20}
}

func (m *Manager) PathForRun(runID string) string { return filepath.Join(m.Root, runID) }
func (m *Manager) Create(runID string) (string, error) {
	p := m.PathForRun(runID)
	return p, os.MkdirAll(p, 0o755)
}
func (m *Manager) CleanupExpired(now time.Time) error {
	entries, err := os.ReadDir(m.Root)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		info, _ := e.Info()
		if now.Sub(info.ModTime()) > m.TTL {
			_ = os.RemoveAll(filepath.Join(m.Root, e.Name()))
		}
	}
	return nil
}

func (m *Manager) Resolve(runID, rel string) (string, error) {
	if strings.TrimSpace(rel) == "" || filepath.IsAbs(rel) {
		return "", errors.New("invalid path")
	}
	root := m.PathForRun(runID)
	full := filepath.Join(root, filepath.Clean(rel))
	relPath, err := filepath.Rel(root, full)
	if err != nil {
		return "", err
	}
	if relPath == ".." || strings.HasPrefix(relPath, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path traversal blocked: %s", rel)
	}
	resolved, err := filepath.EvalSymlinks(filepath.Dir(full))
	if err == nil {
		relToRoot, _ := filepath.Rel(root, resolved)
		if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
			return "", errors.New("symlink escape blocked")
		}
	}
	return full, nil
}

func (m *Manager) SafeWrite(runID, rel, content string) error {
	if int64(len(content)) > m.MaxFileBytes {
		return errors.New("write exceeds max file size")
	}
	full, err := m.Resolve(runID, rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	return os.WriteFile(full, []byte(content), 0o644)
}

func (m *Manager) SafeRead(runID, rel string) ([]byte, error) {
	full, err := m.Resolve(runID, rel)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(full)
	if err != nil {
		return nil, err
	}
	if info.Size() > m.MaxFileBytes {
		return nil, errors.New("read exceeds max file size")
	}
	return os.ReadFile(full)
}

func DirSize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		info, statErr := d.Info()
		if statErr != nil {
			return statErr
		}
		total += info.Size()
		return nil
	})
	return total, err
}
