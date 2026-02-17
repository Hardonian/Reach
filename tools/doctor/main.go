package main

import (
	"encoding/json"
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
	dir     string
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

	checks := []check{
		{name: "go available", command: []string{"go", "version"}, fix: "Install Go 1.22+ and ensure go is on PATH."},
		{name: "rust available", command: []string{"rustc", "--version"}, fix: "Install Rust stable via rustup."},
		{name: "node available", command: []string{"node", "--version"}, fix: "Install Node.js 18+ and ensure node is on PATH."},
		{name: "protocol schema validation", command: []string{"node", "tools/codegen/validate-protocol.mjs"}, fix: "Fix schema violations under protocol/schemas."},
		{name: "go tests (runner)", command: []string{"go", "test", "./..."}, dir: "services/runner", fix: "Resolve failing tests under services/runner."},
		{name: "queue migrations present", command: []string{"bash", "-lc", "test -f services/runner/internal/storage/migrations/002_orchestration.sql"}, fix: "Run orchestration migration generation."},
		{name: "node registry table probe", command: []string{"bash", "-lc", "sqlite3 /tmp/reach-doctor.sqlite \".read services/runner/internal/storage/migrations/001_init.sql\" && sqlite3 /tmp/reach-doctor.sqlite \".read services/runner/internal/storage/migrations/002_orchestration.sql\" && sqlite3 /tmp/reach-doctor.sqlite \"select count(*) from nodes;\""}, fix: "Validate sqlite3 availability and migration SQL syntax."},
	}

	for _, c := range []check{
		{name: "protocol schema validation", command: []string{"node", "tools/codegen/validate-protocol.mjs"}, fix: "Fix schema violations under protocol/schemas."},
		{name: "go tests (runner)", command: []string{"go", "test", "./..."}, fix: "Resolve failing tests under services/runner."},
		{name: "go tests (connector-registry)", command: []string{"go", "test", "./..."}, fix: "Resolve failing tests under services/connector-registry."},
	} {
	failures := 0
	for _, c := range checks {
		if err := runCheck(root, c); err != nil {
			failures++
		}
	}

	for _, fn := range []func(string) error{checkRegistryIndex, checkLockfileConsistency, checkRiskySettings} {
		if err := fn(root); err != nil {
			fmt.Printf("[FAIL] %v\n", err)
			failures++
		} else {
			fmt.Println("[OK]   custom check")
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
	if c.dir != "" {
		cmd.Dir = filepath.Join(root, c.dir)
	}
	if c.name == "go tests (connector-registry)" {
		cmd.Dir = filepath.Join(root, "services", "connector-registry")
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

func checkRegistryIndex(root string) error {
	path := filepath.Join(root, "connectors", "index.json")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return fmt.Errorf("registry index invalid json: %w", err)
	}
	return nil
}

func checkLockfileConsistency(root string) error {
	path := filepath.Join(root, "reach.lock.json")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return fmt.Errorf("lockfile invalid json: %w", err)
	}
	return nil
}

func checkRiskySettings(root string) error {
	envPath := filepath.Join(root, ".env")
	data, err := os.ReadFile(envPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if strings.Contains(string(data), "ENV=prod") && strings.Contains(string(data), "DEV_ALLOW_UNSIGNED=1") {
		return fmt.Errorf("DEV_ALLOW_UNSIGNED=1 enabled in prod")
	}
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
