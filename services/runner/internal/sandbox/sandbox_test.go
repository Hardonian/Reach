package sandbox

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestEnforcementLayer_RegisterAndCheck(t *testing.T) {
	sandbox := NewEnforcementLayer("/tmp/workspace")
	runID := "run-123"

	// Register a run with specific capabilities and tools
	sandbox.RegisterRun(runID,
		[]string{"filesystem:read", "filesystem:write"},
		[]string{"tool.read_file", "tool.write_file"},
		[]string{"HOME", "PATH"},
	)
	defer sandbox.UnregisterRun(runID)

	// Check allowed tool
	if err := sandbox.CheckToolAccess(runID, "tool.read_file"); err != nil {
		t.Errorf("Expected tool.read_file to be allowed, got: %v", err)
	}

	// Check disallowed tool
	if err := sandbox.CheckToolAccess(runID, "tool.exec"); err == nil {
		t.Error("Expected tool.exec to be denied")
	}

	// Check allowed capability
	if err := sandbox.CheckCapabilityAccess(runID, "filesystem:read"); err != nil {
		t.Errorf("Expected filesystem:read to be allowed, got: %v", err)
	}

	// Check disallowed capability
	if err := sandbox.CheckCapabilityAccess(runID, "network:access"); err == nil {
		t.Error("Expected network:access to be denied")
	}
}

func TestEnforcementLayer_UnregisteredRun(t *testing.T) {
	sandbox := NewEnforcementLayer("/tmp/workspace")

	// Check tool on unregistered run
	if err := sandbox.CheckToolAccess("unregistered", "tool.read_file"); err == nil {
		t.Error("Expected error for unregistered run")
	}
}

func TestEnforcementLayer_ResolveWorkspacePath(t *testing.T) {
	workspace := t.TempDir()
	sandbox := NewEnforcementLayer(workspace)
	runID := "run-456"

	sandbox.RegisterRun(runID, []string{}, []string{}, []string{})
	defer sandbox.UnregisterRun(runID)

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"valid file", "test.txt", false},
		{"valid nested", "subdir/nested.txt", false},
		{"empty path", "", true},
		{"path traversal", "../escape.txt", true},
		{"nested traversal", "foo/../../escape.txt", true},
		// Note: On Windows, absolute paths like "C:\\Windows" are handled differently
		// The sandbox uses filepath.Join which handles this correctly
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := sandbox.ResolveWorkspacePath(runID, tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("ResolveWorkspacePath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got == "" {
				t.Error("Expected non-empty path")
			}
		})
	}
}

func TestEnforcementLayer_SecureFileOperations(t *testing.T) {
	workspace := t.TempDir()
	sandbox := NewEnforcementLayer(workspace)
	runID := "run-789"

	sandbox.RegisterRun(runID, []string{}, []string{}, []string{})
	defer sandbox.UnregisterRun(runID)

	// Test write
	content := []byte("hello, sandbox!")
	if err := sandbox.SecureWriteFile(runID, "test.txt", content); err != nil {
		t.Fatalf("SecureWriteFile failed: %v", err)
	}

	// Verify file exists
	fullPath := filepath.Join(workspace, "test.txt")
	if _, err := os.Stat(fullPath); err != nil {
		t.Errorf("File was not created: %v", err)
	}

	// Test read
	readContent, err := sandbox.SecureReadFile(runID, "test.txt")
	if err != nil {
		t.Fatalf("SecureReadFile failed: %v", err)
	}
	if string(readContent) != string(content) {
		t.Errorf("Read content mismatch: got %s, want %s", readContent, content)
	}

	// Test read outside sandbox
	if _, err := sandbox.SecureReadFile(runID, "../outside.txt"); err == nil {
		t.Error("Expected error for path outside sandbox")
	}
}

func TestEnforcementLayer_CheckEnvAccess(t *testing.T) {
	sandbox := NewEnforcementLayer("/tmp/workspace")
	runID := "run-abc"

	// Register with specific env vars and patterns
	sandbox.RegisterRun(runID, []string{}, []string{}, []string{"HOME", "REACH_*", "API_KEY"})
	defer sandbox.UnregisterRun(runID)

	tests := []struct {
		name    string
		envVar  string
		wantErr bool
	}{
		{"exact match", "HOME", false},
		{"pattern match", "REACH_DEBUG", false},
		{"pattern match 2", "REACH_VERSION", false},
		{"not declared", "SECRET_TOKEN", true},
		{"partial pattern", "NOT_REACH", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := sandbox.CheckEnvAccess(runID, tt.envVar)
			if (err != nil) != tt.wantErr {
				t.Errorf("CheckEnvAccess() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEnforcementLayer_EnforcedToolCall(t *testing.T) {
	sandbox := NewEnforcementLayer("/tmp/workspace")
	runID := "run-def"

	sandbox.RegisterRun(runID, []string{}, []string{"tool.allowed"}, []string{})
	defer sandbox.UnregisterRun(runID)

	// Test allowed tool
	ctx := context.Background()
	handler := func(ctx context.Context) (any, error) {
		return "success", nil
	}

	result, err := sandbox.EnforcedToolCall(ctx, runID, "tool.allowed", handler)
	if err != nil {
		t.Errorf("Expected allowed tool to succeed, got: %v", err)
	}
	if result != "success" {
		t.Errorf("Expected 'success', got: %v", result)
	}

	// Test disallowed tool
	_, err = sandbox.EnforcedToolCall(ctx, runID, "tool.disallowed", handler)
	if err == nil {
		t.Error("Expected disallowed tool to fail")
	}
}

func TestEnforcementLayer_MaliciousPathTraversal(t *testing.T) {
	workspace := t.TempDir()
	sandbox := NewEnforcementLayer(workspace)
	runID := "run-malicious"

	sandbox.RegisterRun(runID, []string{}, []string{}, []string{})
	defer sandbox.UnregisterRun(runID)

	// Create a file outside the workspace
	outsideFile := filepath.Join(workspace, "..", "outside.txt")
	outsideFile = filepath.Clean(outsideFile)
	_ = os.WriteFile(outsideFile, []byte("secret"), 0o644)
	defer os.Remove(outsideFile)

	// Try to read it via path traversal
	traversalPaths := []string{
		"../outside.txt",
		"foo/../../../outside.txt",
		"./../outside.txt",
		"subdir/../../outside.txt",
	}

	for _, path := range traversalPaths {
		_, err := sandbox.SecureReadFile(runID, path)
		if err == nil {
			t.Errorf("Path traversal should be blocked: %s", path)
		}
	}
}

// BenchmarkCheckToolAccess measures the performance of tool access checks
func BenchmarkCheckToolAccess(b *testing.B) {
	sandbox := NewEnforcementLayer("/tmp/workspace")
	runID := "bench-run"

	// Register with many tools
	tools := make([]string, 100)
	for i := range tools {
		tools[i] = fmt.Sprintf("tool.%d", i)
	}
	sandbox.RegisterRun(runID, []string{}, tools, []string{})
	defer sandbox.UnregisterRun(runID)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = sandbox.CheckToolAccess(runID, "tool.50")
	}
}
