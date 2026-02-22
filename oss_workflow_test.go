package main_test

import (
	"os/exec"
	"testing"
)

// TestReachCtlSmoke implements the "Local Workflow Validation" checks
// from the OSS-First Pivot Plan (Phase 2.1 & 2.3).
// It verifies that all core commands are wired up and do not panic on start.
func TestReachCtlSmoke(t *testing.T) {
	// List of commands exposed in the reach bash script and reachctl
	commands := []string{
		"doctor",
		"version",
		"init",
		"run",
		"pack",
		"capsule",
		"wizard",
		"share",
		"operator",
		"audit",
		"gate",
		"explain",
		"federation",
		"support",
		"proof",
	}

	for _, cmd := range commands {
		t.Run(cmd, func(t *testing.T) {
			// Verify the command accepts --help and exits with 0
			// This ensures the command is wired up and doesn't panic on init
			c := exec.Command("go", "run", ".", cmd, "--help")
			output, err := c.CombinedOutput()
			if err != nil {
				t.Logf("Command output: %s", output)
				t.Fatalf("reachctl %s --help failed: %v", cmd, err)
			}
		})
	}
}
