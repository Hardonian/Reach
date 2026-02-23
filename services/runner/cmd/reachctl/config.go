package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// runConfig handles the 'config' subcommand.
// Usage: reachctl config <subcommand>
func runConfig(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(errOut, "usage: reachctl config <subcommand>")
		return 1
	}
	switch args[0] {
	case "init":
		return runConfigInit(out, errOut)
	default:
		fmt.Fprintf(errOut, "unknown config command: %s\n", args[0])
		return 1
	}
}

func runConfigInit(out io.Writer, errOut io.Writer) int {
	root, err := getRepoRoot()
	if err != nil {
		fmt.Fprintf(errOut, "Error finding repo root: %v\n", err)
		return 1
	}

	envPath := filepath.Join(root, ".env")
	if _, err := os.Stat(envPath); err == nil {
		fmt.Fprintln(out, "Configuration already exists at .env")
		return 0
	}

	// Minimal default config matching doctor --fix logic
	content := `# Reach Configuration
NEXT_PUBLIC_BRAND_NAME=ReadyLayer
`
	if err := os.WriteFile(envPath, []byte(content), 0644); err != nil {
		fmt.Fprintf(errOut, "Failed to create config: %v\n", err)
		return 1
	}
	fmt.Fprintln(out, "Initialized default configuration at .env")
	return 0
}

func getRepoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}