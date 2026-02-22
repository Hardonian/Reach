package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type checkResult struct {
	name        string
	ok          bool
	severity    string
	remediation string
	detail      string
}

func (c checkResult) MarshalJSON() ([]byte, error) {
	status := "FAIL"
	if c.ok {
	if c.severity != "" {
		status = c.severity
	} else if c.ok {
		status = "OK"
	}
	return json.Marshal(struct {
		Name        string `json:"name"`
		Status      string `json:"status"`
		Remediation string `json:"remediation,omitempty"`
		Detail      string `json:"detail,omitempty"`
	}{
		Name:        c.name,
		Status:      status,
		Remediation: c.remediation,
		Detail:      c.detail,
	})
}

func main() {
	// Check if running in mobile mode
	if os.Getenv("REACH_MOBILE") == "1" || os.Getenv("TERMUX_VERSION") != "" {
		runMobileDoctor()
		return
	}

	jsonOutput := false
	for _, arg := range os.Args {
		if arg == "--json" {
			jsonOutput = true
			break
		}
	}

	root, err := repoRoot()
	if err != nil {
		if jsonOutput {
			fmt.Printf(`{"error": "repo root: %s"}`, err)
			os.Exit(1)
		}
		fmt.Printf("reach doctor: fail: repo root: %v\n", err)
		os.Exit(1)
	}

	if !jsonOutput {
		fmt.Printf("reach doctor (%s/%s)\n", runtime.GOOS, runtime.GOARCH)
	}

	checks := []func(string) checkResult{
		checkGitInstalled,
		checkDockerRunning,
		checkNodeVersion,
		checkNpmInstalled,
		checkMakeInstalled,
		checkRegistrySourceConfig,
		checkIndexSchemaAndCache,
		checkSignatureVerificationPath,
		checkPolicyEngineReachableConfig,
		checkRunnerCapabilityFirewall,
		checkMarketplaceConsentRequirements,
		checkArchitectureBoundaries,
	}

	failures := 0
	var results []checkResult
	for _, run := range checks {
		result := run(root)
		results = append(results, result)
		if !result.ok {
			failures++
		}

		if !jsonOutput {
			if result.ok {
			if result.ok && result.severity != "WARN" {
				fmt.Printf("[OK]   %s\n", result.name)
				continue
			}
			fmt.Printf("[FAIL] %s\n", result.name)
			label := "FAIL"
			if result.severity != "" {
				label = result.severity
			}
			fmt.Printf("[%s] %s\n", label, result.name)
			if result.detail != "" {
				fmt.Printf("       %s\n", result.detail)
			}
			if result.remediation != "" {
				fmt.Printf("       remediation: %s\n", result.remediation)
			}
		}
	}

	if jsonOutput {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(struct {
			Brand    string        `json:"brand"`
			Version  string        `json:"version"`
			Checks   []checkResult `json:"checks"`
			Failures int           `json:"failures"`
		}{
			Brand:    "Reach",
			Version:  "0.3.1",
			Checks:   results,
			Failures: failures,
		})
		if failures > 0 {
			os.Exit(1)
		}
		return
	}

	if failures > 0 {
		fmt.Printf("\nreach doctor found %d issue(s)\n", failures)
		os.Exit(1)
	}
	fmt.Println("\nreach doctor passed")
}

func runMobileDoctor() {
	doctor := NewMobileDoctor()
	report := doctor.Run()

	// Output as JSON if requested
	if len(os.Args) > 1 && os.Args[1] == "--json" {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(report)
		if report.Summary.Overall == "needs_attention" {
			os.Exit(1)
		}
		return
	}

	fmt.Print(report.ToHuman())

	if report.Summary.Overall == "needs_attention" {
		os.Exit(1)
	}
}

func checkGitInstalled(root string) checkResult {
	name := "git installed and accessible"
	path, err := exec.LookPath("git")
	if err != nil {
		return fail(name, err, "install git and ensure it is in PATH")
	}
	if err := exec.Command(path, "--version").Run(); err != nil {
		return fail(name, err, "git found but not executable")
	}
	return pass(name)
}

func checkDockerRunning(root string) checkResult {
	name := "docker installed and running"
	path, err := exec.LookPath("docker")
	if err != nil {
		return fail(name, err, "install docker and ensure it is in PATH")
	}
	if err := exec.Command(path, "info").Run(); err != nil {
		return fail(name, err, "docker found but daemon not reachable (is Docker Desktop running?)")
	}
	return pass(name)
}

func checkNodeVersion(root string) checkResult {
	name := "node version >= 18"
	path, err := exec.LookPath("node")
	if err != nil {
		return fail(name, err, "install nodejs >= 18")
	}
	out, err := exec.Command(path, "--version").Output()
	if err != nil {
		return fail(name, err, "node found but not executable")
	}
	versionStr := strings.TrimSpace(string(out))
	v := strings.TrimPrefix(versionStr, "v")
	parts := strings.Split(v, ".")
	if len(parts) > 0 {
		if major, err := strconv.Atoi(parts[0]); err == nil {
			if major >= 18 {
				return pass(name)
			}
			return checkResult{
				name:        name,
				detail:      fmt.Sprintf("found %s", versionStr),
				remediation: "upgrade nodejs to >= 18",
			}
		}
	}
	return fail(name, fmt.Errorf("could not parse version: %s", versionStr), "ensure node --version returns standard version string")
}

func checkNpmInstalled(root string) checkResult {
	name := "npm installed and accessible"
	path, err := exec.LookPath("npm")
	if err != nil {
		return fail(name, err, "install npm (usually comes with nodejs)")
	}
	if err := exec.Command(path, "--version").Run(); err != nil {
		return fail(name, err, "npm found but not executable")
	}
	return pass(name)
}

func checkMakeInstalled(root string) checkResult {
	name := "make installed"
	path, err := exec.LookPath("make")
	if err != nil {
		return checkResult{name: name, ok: true, severity: "WARN", detail: "make not found", remediation: "install make for building from source"}
	}
	if err := exec.Command(path, "--version").Run(); err != nil {
		return checkResult{name: name, ok: true, severity: "WARN", detail: "make found but not executable"}
	}
	return pass(name)
}

func checkRegistrySourceConfig(root string) checkResult {
	name := "registry sources config"
	cmdPath := filepath.Join(root, "services", "connector-registry", "cmd", "connector-registry", "main.go")
	data, err := os.ReadFile(cmdPath)
	if err != nil {
		return fail(name, err, "restore connector-registry command source")
	}
	text := string(data)
	if !strings.Contains(text, "CONNECTOR_REGISTRY_REMOTE_INDEX_URL") {
		return checkResult{name: name, remediation: "wire remote index through CONNECTOR_REGISTRY_REMOTE_INDEX_URL", detail: "env key missing in connector-registry bootstrap"}
	}
	if !strings.Contains(text, "PACKKIT_TRUSTED_KEYS") {
		return checkResult{name: name, remediation: "keep trusted key file configurable", detail: "trusted key env key missing"}
	}
	return pass(name)
}

func checkIndexSchemaAndCache(root string) checkResult {
	name := "index schema and cache guards"
	file := filepath.Join(root, "services", "connector-registry", "internal", "registry", "marketplace.go")
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(name, err, "restore marketplace registry implementation")
	}
	text := string(data)
	needles := []string{"catalogTTL", "catalogMaxItems", "packregistry.ParseIndex", "SetCatalogTTL"}
	for _, needle := range needles {
		if !strings.Contains(text, needle) {
			return checkResult{name: name, remediation: "enforce TTL + bounded item cache with schema parse", detail: "missing marker: " + needle}
		}
	}
	return pass(name)
}

func checkSignatureVerificationPath(root string) checkResult {
	name := "signature verification path"
	file := filepath.Join(root, "services", "connector-registry", "internal", "registry", "registry.go")
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(name, err, "restore connector registry installation flow")
	}
	text := string(data)
	if !strings.Contains(text, "VerifyManifestSignature") || !strings.Contains(text, "signature required in prod mode") {
		return checkResult{name: name, remediation: "do not bypass manifest signature verification outside dev mode", detail: "signature gate missing"}
	}
	return pass(name)
}

func checkPolicyEngineReachableConfig(root string) checkResult {
	name := "policy engine reachable config"
	file := filepath.Join(root, "services", "integration-hub", "cmd", "integration-hub", "main.go")
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(name, err, "restore integration-hub bootstrap")
	}
	if !strings.Contains(string(data), "RUNNER_INTERNAL_URL") {
		return checkResult{name: name, remediation: "configure runner URL through RUNNER_INTERNAL_URL and keep policy endpoint wiring intact", detail: "runner/policy routing env missing"}
	}
	return pass(name)
}

func checkRunnerCapabilityFirewall(root string) checkResult {
	name := "runner capability firewall"
	file := filepath.Join(root, "services", "runner", "internal", "mcpserver", "policy.go")
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(name, err, "restore runner policy firewall")
	}
	text := string(data)
	if !strings.Contains(text, "CapabilityFilesystemWrite") || !strings.Contains(text, "ProfileAllowed") {
		return checkResult{name: name, remediation: "enforce capability checks before tool execution", detail: "runner capability policy markers missing"}
	}
	return pass(name)
}

func checkMarketplaceConsentRequirements(root string) checkResult {
	name := "marketplace install consent requirements"
	file := filepath.Join(root, "services", "connector-registry", "internal", "registry", "marketplace.go")
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(name, err, "restore marketplace install flow")
	}
	text := string(data)
	needles := []string{"IdempotencyKey", "AcceptedCapabilities", "AcceptedRisk", "risk acceptance required"}
	for _, needle := range needles {
		if !strings.Contains(text, needle) {
			return checkResult{name: name, remediation: "require explicit consent fields in marketplace install", detail: "missing marker: " + needle}
		}
	}
	return pass(name)
}

func checkArchitectureBoundaries(root string) checkResult {
	name := "architecture boundaries"
	violations, err := boundaryViolations(root)
	if err != nil {
		return fail(name, err, "fix boundary checker parser errors")
	}
	if len(violations) > 0 {
		return checkResult{name: name, detail: strings.Join(violations, "; "), remediation: "remove forbidden imports between marketplace/api/packkit/runner modules"}
	}
	return pass(name)
}

func boundaryViolations(root string) ([]string, error) {
	fset := token.NewFileSet()
	files := []string{}
	for _, dir := range []string{
		filepath.Join(root, "services", "connector-registry", "internal", "api"),
		filepath.Join(root, "services", "runner", "internal", "api"),
		filepath.Join(root, "tools", "packkit"),
	} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".go") && !strings.HasSuffix(e.Name(), "_test.go") {
				files = append(files, filepath.Join(dir, e.Name()))
			}
		}
	}

	violations := []string{}
	for _, file := range files {
		node, err := parser.ParseFile(fset, file, nil, parser.ImportsOnly)
		if err != nil {
			return nil, err
		}
		for _, imp := range node.Imports {
			path := strings.Trim(imp.Path.Value, "\"")
			rel, _ := filepath.Rel(root, file)
			switch {
			case strings.HasPrefix(rel, "services/connector-registry/internal/api") && strings.Contains(path, "services/runner/internal"):
				violations = append(violations, rel+" imports "+path)
			case strings.HasPrefix(rel, "services/runner/internal/api") && strings.Contains(path, "webhook"):
				violations = append(violations, rel+" imports secret-bearing module "+path)
			case strings.HasPrefix(rel, "tools/packkit") && strings.Contains(path, "internal/packkit/config"):
				violations = append(violations, rel+" imports config.AllowUnsigned path "+path)
			}
		}
	}

	// Also ensure packkit verification cannot be removed from install path.
	installFile := filepath.Join(root, "services", "connector-registry", "internal", "registry", "registry.go")
	src, err := os.ReadFile(installFile)
	if err != nil {
		return nil, err
	}
	if !strings.Contains(string(src), "VerifyManifestSignature") {
		violations = append(violations, "services/connector-registry/internal/registry/registry.go missing VerifyManifestSignature")
	}

	_ = ast.File{}
	return violations, nil
}

func pass(name string) checkResult { return checkResult{name: name, ok: true} }

func fail(name string, err error, remediation string) checkResult {
	return checkResult{name: name, detail: err.Error(), remediation: remediation}
}

func repoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func _lintJSON(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var v map[string]any
	return json.Unmarshal(data, &v)
}
