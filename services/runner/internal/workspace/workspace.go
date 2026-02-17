package workspace

import "path/filepath"

type Manager struct {
	Root string
}

func NewManager(root string) *Manager {
	return &Manager{Root: root}
}

func (m *Manager) PathForRun(runID string) string {
	return filepath.Join(m.Root, runID)
}
