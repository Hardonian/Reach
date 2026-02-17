package workspace

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTraversalFails(t *testing.T) {
	m := NewManager(t.TempDir())
	_, _ = m.Create("run-1")
	if err := m.SafeWrite("run-1", "../escape.txt", "x"); err == nil {
		t.Fatal("expected traversal failure")
	}
}

func TestOversizeWriteFails(t *testing.T) {
	m := NewManager(t.TempDir())
	m.MaxFileBytes = 4
	_, _ = m.Create("run-1")
	if err := m.SafeWrite("run-1", "a.txt", "12345"); err == nil {
		t.Fatal("expected oversize failure")
	}
}

func TestTTLCleanupWorks(t *testing.T) {
	m := NewManager(t.TempDir())
	m.TTL = time.Second
	runPath, _ := m.Create("run-1")
	old := time.Now().Add(-5 * time.Second)
	_ = os.Chtimes(runPath, old, old)
	if err := m.CleanupExpired(time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(m.Root, "run-1")); !os.IsNotExist(err) {
		t.Fatal("expected workspace removed")
	}
}
