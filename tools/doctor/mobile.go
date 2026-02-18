package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// MobileDoctor performs mobile-specific health checks
type MobileDoctor struct {
	IsMobile    bool
	IsTermux    bool
	DataDir     string
	MaxMemoryMB int
}

// MobileCheckResult represents a single mobile health check
type MobileCheckResult struct {
	Name        string `json:"name"`
	Status      string `json:"status"` // pass, fail, warn
	Message     string `json:"message"`
	Category    string `json:"category"`
	Remediation string `json:"remediation,omitempty"`
}

// MobileReport aggregates all mobile health checks
type MobileReport struct {
	Environment MobileEnv           `json:"environment"`
	Checks      []MobileCheckResult `json:"checks"`
	Summary     MobileSummary       `json:"summary"`
	QuickFixes  []string            `json:"quick_fixes,omitempty"`
}

// MobileEnv describes the mobile environment
type MobileEnv struct {
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	IsTermux     bool   `json:"is_termux"`
	TermuxVer    string `json:"termux_version,omitempty"`
	DataDir      string `json:"data_dir"`
	StorageAvail int64  `json:"storage_available_mb"`
}

// MobileSummary provides a quick overview
type MobileSummary struct {
	Pass    int    `json:"pass"`
	Fail    int    `json:"fail"`
	Warn    int    `json:"warn"`
	Overall string `json:"overall"`
}

// NewMobileDoctor creates a mobile doctor instance
func NewMobileDoctor() *MobileDoctor {
	isTermux := os.Getenv("TERMUX_VERSION") != "" || strings.HasPrefix(os.Getenv("PREFIX"), "/data/data/com.termux")
	dataDir := os.Getenv("REACH_DATA_DIR")
	if dataDir == "" {
		if isTermux {
			dataDir = filepath.Join(os.Getenv("HOME"), ".reach", "data")
		} else {
			dataDir = "data"
		}
	}

	maxMem := 256 // default for mobile
	if mem := os.Getenv("REACH_MAX_MEMORY_MB"); mem != "" {
		if m, err := strconv.Atoi(mem); err == nil {
			maxMem = m
		}
	}

	return &MobileDoctor{
		IsMobile:    os.Getenv("REACH_MOBILE") == "1" || isTermux,
		IsTermux:    isTermux,
		DataDir:     dataDir,
		MaxMemoryMB: maxMem,
	}
}

// Run performs all mobile health checks
func (d *MobileDoctor) Run() *MobileReport {
	report := &MobileReport{
		Environment: d.detectEnv(),
		Checks:      []MobileCheckResult{},
		QuickFixes:  []string{},
	}

	// Run all checks
	checks := []func() MobileCheckResult{
		d.checkStorage,
		d.checkMemory,
		d.checkTermuxAPI,
		d.checkDataDir,
		d.checkNetwork,
		d.checkGoRuntime,
		d.checkRegistry,
	}

	for _, check := range checks {
		result := check()
		report.Checks = append(report.Checks, result)
		switch result.Status {
		case "pass":
			report.Summary.Pass++
		case "fail":
			report.Summary.Fail++
			if result.Remediation != "" {
				report.QuickFixes = append(report.QuickFixes, result.Remediation)
			}
		case "warn":
			report.Summary.Warn++
		}
	}

	// Determine overall status
	if report.Summary.Fail > 0 {
		report.Summary.Overall = "needs_attention"
	} else if report.Summary.Warn > 0 {
		report.Summary.Overall = "healthy_with_warnings"
	} else {
		report.Summary.Overall = "healthy"
	}

	return report
}

func (d *MobileDoctor) detectEnv() MobileEnv {
	env := MobileEnv{
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		IsTermux: d.IsTermux,
		DataDir:  d.DataDir,
	}

	if d.IsTermux {
		env.TermuxVer = os.Getenv("TERMUX_VERSION")
	}

	// Storage availability check skipped on non-Unix platforms
	// On Android/Termux, this would use syscall.Statvfs
	env.StorageAvail = -1 // unknown

	return env
}

func (d *MobileDoctor) checkStorage() MobileCheckResult {
	// Check if data directory is writable
	testFile := filepath.Join(d.DataDir, ".write_test")
	if err := os.MkdirAll(d.DataDir, 0755); err != nil {
		return MobileCheckResult{
			Name:        "Storage",
			Status:      "fail",
			Message:     fmt.Sprintf("Cannot create data directory: %v", err),
			Category:    "storage",
			Remediation: "Run: mkdir -p " + d.DataDir,
		}
	}

	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return MobileCheckResult{
			Name:        "Storage",
			Status:      "fail",
			Message:     fmt.Sprintf("Cannot write to data directory: %v", err),
			Category:    "storage",
			Remediation: "Check permissions: ls -la " + d.DataDir,
		}
	}
	os.Remove(testFile)

	return MobileCheckResult{
		Name:     "Storage",
		Status:   "pass",
		Message:  "Data directory is writable",
		Category: "storage",
	}
}

func (d *MobileDoctor) checkMemory() MobileCheckResult {
	// Check available memory
	if d.MaxMemoryMB < 128 {
		return MobileCheckResult{
			Name:        "Memory",
			Status:      "warn",
			Message:     fmt.Sprintf("Very low memory limit: %dMB", d.MaxMemoryMB),
			Category:    "performance",
			Remediation: "Increase memory: export REACH_MAX_MEMORY_MB=256",
		}
	}

	if d.MaxMemoryMB > 512 && d.IsMobile {
		return MobileCheckResult{
			Name:        "Memory",
			Status:      "warn",
			Message:     fmt.Sprintf("High memory setting (%dMB) may impact device performance", d.MaxMemoryMB),
			Category:    "performance",
			Remediation: "Consider reducing: export REACH_MAX_MEMORY_MB=256",
		}
	}

	return MobileCheckResult{
		Name:     "Memory",
		Status:   "pass",
		Message:  fmt.Sprintf("Memory configured for %dMB (mobile-optimized)", d.MaxMemoryMB),
		Category: "performance",
	}
}

func (d *MobileDoctor) checkTermuxAPI() MobileCheckResult {
	if !d.IsTermux {
		return MobileCheckResult{
			Name:     "Termux API",
			Status:   "pass",
			Message:  "Not running in Termux (optional)",
			Category: "features",
		}
	}

	// Check if termux-api is installed
	apiPath := os.Getenv("PREFIX") + "/libexec/termux-api"
	if _, err := os.Stat(apiPath); os.IsNotExist(err) {
		return MobileCheckResult{
			Name:        "Termux API",
			Status:      "warn",
			Message:     "termux-api not installed (QR codes, sharing disabled)",
			Category:    "features",
			Remediation: "pkg install termux-api",
		}
	}

	return MobileCheckResult{
		Name:     "Termux API",
		Status:   "pass",
		Message:  "Termux API available for QR codes and sharing",
		Category: "features",
	}
}

func (d *MobileDoctor) checkDataDir() MobileCheckResult {
	required := []string{"runs", "capsules", "registry"}
	missing := []string{}

	for _, dir := range required {
		path := filepath.Join(d.DataDir, dir)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			missing = append(missing, dir)
			os.MkdirAll(path, 0755)
		}
	}

	if len(missing) > 0 {
		return MobileCheckResult{
			Name:     "Data Structure",
			Status:   "warn",
			Message:  fmt.Sprintf("Created missing directories: %v", missing),
			Category: "storage",
		}
	}

	return MobileCheckResult{
		Name:     "Data Structure",
		Status:   "pass",
		Message:  "All required data directories present",
		Category: "storage",
	}
}

func (d *MobileDoctor) checkNetwork() MobileCheckResult {
	// For mobile, we prefer offline-first but check connectivity
	if os.Getenv("REACH_OFFLINE_FIRST") == "1" {
		return MobileCheckResult{
			Name:     "Network",
			Status:   "pass",
			Message:  "Offline-first mode enabled (recommended for mobile)",
			Category: "connectivity",
		}
	}

	return MobileCheckResult{
		Name:        "Network",
		Status:      "warn",
		Message:     "Online mode - may use mobile data",
		Category:    "connectivity",
		Remediation: "Enable offline mode: export REACH_OFFLINE_FIRST=1",
	}
}

func (d *MobileDoctor) checkGoRuntime() MobileCheckResult {
	// Check if Go is available
	if _, err := os.Stat(os.Getenv("PREFIX") + "/bin/go"); os.IsNotExist(err) {
		if _, err := os.Stat("/usr/bin/go"); os.IsNotExist(err) {
			return MobileCheckResult{
				Name:        "Go Runtime",
				Status:      "fail",
				Message:     "Go not found - required to run reachctl",
				Category:    "runtime",
				Remediation: "pkg install golang",
			}
		}
	}

	return MobileCheckResult{
		Name:     "Go Runtime",
		Status:   "pass",
		Message:  "Go runtime available",
		Category: "runtime",
	}
}

func (d *MobileDoctor) checkRegistry() MobileCheckResult {
	registryPath := filepath.Join(d.DataDir, "registry", "index.json")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		return MobileCheckResult{
			Name:        "Registry",
			Status:      "warn",
			Message:     "No registry index found",
			Category:    "registry",
			Remediation: "reach packs search (to initialize)",
		}
	}

	// Validate JSON
	data, err := os.ReadFile(registryPath)
	if err != nil {
		return MobileCheckResult{
			Name:     "Registry",
			Status:   "warn",
			Message:  "Cannot read registry index",
			Category: "registry",
		}
	}

	var index map[string]any
	if err := json.Unmarshal(data, &index); err != nil {
		return MobileCheckResult{
			Name:        "Registry",
			Status:      "warn",
			Message:     "Registry index is invalid JSON",
			Category:    "registry",
			Remediation: "Delete and rebuild: rm " + registryPath,
		}
	}

	return MobileCheckResult{
		Name:     "Registry",
		Status:   "pass",
		Message:  "Registry index valid",
		Category: "registry",
	}
}

// ToHuman formats the report for terminal display
func (r *MobileReport) ToHuman() string {
	var sb strings.Builder

	emoji := map[string]string{
		"healthy":               "✓",
		"healthy_with_warnings": "⚠",
		"needs_attention":       "✗",
		"pass":                  "✓",
		"fail":                  "✗",
		"warn":                  "⚠",
	}

	sb.WriteString(fmt.Sprintf("\n%s Mobile Health Report\n", emoji[r.Summary.Overall]))
	sb.WriteString(fmt.Sprintf("Environment: %s/%s", r.Environment.OS, r.Environment.Arch))
	if r.Environment.IsTermux {
		sb.WriteString(fmt.Sprintf(" (Termux %s)", r.Environment.TermuxVer))
	}
	sb.WriteString("\n\n")

	// Group checks by category
	categories := map[string][]MobileCheckResult{}
	for _, check := range r.Checks {
		categories[check.Category] = append(categories[check.Category], check)
	}

	for cat, checks := range categories {
		sb.WriteString(fmt.Sprintf("[%s]\n", strings.ToUpper(cat)))
		for _, check := range checks {
			sb.WriteString(fmt.Sprintf("  %s %s: %s\n", emoji[check.Status], check.Name, check.Message))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(fmt.Sprintf("Summary: %d passed, %d failed, %d warnings\n",
		r.Summary.Pass, r.Summary.Fail, r.Summary.Warn))

	if len(r.QuickFixes) > 0 {
		sb.WriteString("\nQuick fixes:\n")
		for i, fix := range r.QuickFixes {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, fix))
		}
	}

	return sb.String()
}
