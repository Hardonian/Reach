package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type check struct {
	name    string
	command []string
	fix     string
}

func main() {
	root, err := repoRoot()
	if err != nil {
		fmt.Printf("[FAIL] repo root: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Reach doctor on %s/%s\n", runtime.GOOS, runtime.GOARCH)
	fmt.Printf("repo: %s\n", root)

	failures := 0
	for _, c := range []check{
		{name: "go available", command: []string{"go", "version"}, fix: "Install Go 1.22+ and ensure go is on PATH."},
		{name: "rust available", command: []string{"rustc", "--version"}, fix: "Install Rust stable via rustup."},
		{name: "cargo available", command: []string{"cargo", "--version"}, fix: "Install Rust toolchain with cargo."},
		{name: "node available", command: []string{"node", "--version"}, fix: "Install Node.js 18+ and ensure node is on PATH."},
	} {
		if err := runCheck(root, c); err != nil {
			failures++
		}
	}

	for _, c := range []check{
		{name: "protocol schema validation", command: []string{"node", "tools/codegen/validate-protocol.mjs"}, fix: "Fix schema violations under protocol/schemas."},
		{name: "go tests (runner)", command: []string{"go", "test", "./..."}, fix: "Resolve failing tests under services/runner."},
		{name: "rust tests (engine-core)", command: []string{"cargo", "test", "-p", "engine-core"}, fix: "Resolve failing Rust tests for engine-core."},
	} {
		if err := runCheck(root, c); err != nil {
			failures++
		}
	}

	if failures > 0 {
		fmt.Printf("\nDoctor found %d issue(s).\n", failures)
		os.Exit(1)
	}
	fmt.Println("\nDoctor checks passed.")
}

func runCheck(root string, c check) error {
	cmd := exec.Command(c.command[0], c.command[1:]...)
	cmd.Dir = root
	if c.name == "go tests (runner)" {
		cmd.Dir = filepath.Join(root, "services", "runner")
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("[FAIL] %s\n  cmd: %s\n  output: %s\n  fix: %s\n", c.name, strings.Join(c.command, " "), strings.TrimSpace(string(out)), c.fix)
		return err
	}
	line := strings.Split(strings.TrimSpace(string(out)), "\n")
	preview := "ok"
	if len(line) > 0 && line[0] != "" {
		preview = line[0]
	}
	fmt.Printf("[OK]   %s (%s)\n", c.name, preview)
	return nil
}

func repoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}
