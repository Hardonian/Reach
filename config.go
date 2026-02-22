package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// runConfig handles the 'config' subcommand.
// Usage: reachctl config <subcommand>
func runConfig(args []string) {
	if len(args) == 0 {
		fmt.Println("usage: reachctl config <subcommand>")
		os.Exit(1)
	}
	switch args[0] {
	case "init":
		runConfigInit()
	default:
		fmt.Printf("unknown config command: %s\n", args[0])
		os.Exit(1)
	}
}

func runConfigInit() {
	root, err := getRepoRoot()
	if err != nil {
		fmt.Printf("Error finding repo root: %v\n", err)
		os.Exit(1)
	}

	envPath := filepath.Join(root, ".env")
	if _, err := os.Stat(envPath); err == nil {
		fmt.Println("Configuration already exists at .env")
		return
	}

	// Minimal default config matching doctor --fix logic
	content := `# Reach Configuration
NEXT_PUBLIC_BRAND_NAME=ReadyLayer
`
	if err := os.WriteFile(envPath, []byte(content), 0644); err != nil {
		fmt.Printf("Failed to create config: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Initialized default configuration at .env")
}

func getRepoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}
