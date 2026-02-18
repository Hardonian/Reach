package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"reach/services/runner/internal/federation"
)

func TestWizardQuickMode(t *testing.T) {
	tmpDir := t.TempDir()

	// Create minimal registry
	registryDir := filepath.Join(tmpDir, "registry")
	os.MkdirAll(registryDir, 0755)
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "test.pack", "spec_version": "1.0", "verified": true},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(registryDir, "index.json"), data, 0644)

	var out, errOut bytes.Buffer
	wizard := NewWizard(tmpDir, &out, &errOut, true, true)

	ctx := context.Background()
	code := wizard.Run(ctx)

	if code != 0 {
		t.Fatalf("wizard failed: %d", code)
	}

	// Verify state
	if wizard.State.SelectedPack != "test.pack" {
		t.Errorf("expected pack 'test.pack', got %s", wizard.State.SelectedPack)
	}

	if wizard.State.RunID == "" {
		t.Error("expected run ID to be generated")
	}

	if !wizard.State.Success {
		t.Error("expected success to be true")
	}

	// Verify capsule was created
	if _, err := os.Stat(wizard.State.CapsulePath); os.IsNotExist(err) {
		t.Error("expected capsule file to exist")
	}
}

func TestWizardJSONOutput(t *testing.T) {
	tmpDir := t.TempDir()

	// Setup registry
	registryDir := filepath.Join(tmpDir, "registry")
	os.MkdirAll(registryDir, 0755)
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "demo.pack", "spec_version": "1.0", "verified": true},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(registryDir, "index.json"), data, 0644)

	var out, errOut bytes.Buffer
	wizard := NewWizard(tmpDir, &out, &errOut, true, true)

	ctx := context.Background()
	wizard.Run(ctx)

	// Parse output as JSON
	var state WizardState
	if err := json.Unmarshal(out.Bytes(), &state); err != nil {
		t.Fatalf("output is not valid JSON: %v", err)
	}

	if state.SelectedPack != "demo.pack" {
		t.Errorf("expected pack 'demo.pack', got %s", state.SelectedPack)
	}
}

func TestShareRun(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a run record
	runsDir := filepath.Join(tmpDir, "runs")
	os.MkdirAll(runsDir, 0755)

	record := runRecord{
		RunID:  "test-run-123",
		Pack:   map[string]any{"name": "test.pack"},
		Policy: map[string]any{"decision": "allow"},
		EventLog: []map[string]any{
			{"step": 1, "action": "test"},
		},
	}
	data, _ := json.Marshal(record)
	os.WriteFile(filepath.Join(runsDir, "test-run-123.json"), data, 0644)

	var out, errOut bytes.Buffer
	code := shareRun(tmpDir, "test-run-123", &out, &errOut)

	if code != 0 {
		t.Fatalf("share failed: %d", code)
	}

	output := out.String()

	// Verify share URL is present
	if !strings.Contains(output, "reach://share/test-run-123") {
		t.Error("expected share URL in output")
	}

	// Verify QR code placeholder
	if !strings.Contains(output, "QR Code") {
		t.Error("expected QR Code header in output")
	}

	// Verify capsule was created
	capsulePath := filepath.Join(tmpDir, "capsules", "test-run-123.capsule.json")
	if _, err := os.Stat(capsulePath); os.IsNotExist(err) {
		t.Error("expected capsule to be created")
	}
}

func TestShareCapsule(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a capsule
	cap := capsuleFile{
		Manifest: capsuleManifest{
			SpecVersion:    "1.0",
			RunID:          "test-run-456",
			RunFingerprint: "abc123",
		},
		EventLog: []map[string]any{
			{"step": 1, "action": "test"},
		},
	}

	capsulePath := filepath.Join(tmpDir, "test.capsule.json")
	data, _ := json.Marshal(cap)
	os.WriteFile(capsulePath, data, 0644)

	var out, errOut bytes.Buffer
	code := shareCapsule(capsulePath, &out, &errOut)

	if code != 0 {
		t.Fatalf("share capsule failed: %d", code)
	}

	output := out.String()

	// Verify run ID is shown
	if !strings.Contains(output, "test-run-456") {
		t.Error("expected run ID in output")
	}

	// Verify QR code
	if !strings.Contains(output, "QR Code") {
		t.Error("expected QR Code header")
	}
}

func TestOperatorMetrics(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test data structure
	runsDir := filepath.Join(tmpDir, "runs")
	capsulesDir := filepath.Join(tmpDir, "capsules")
	os.MkdirAll(runsDir, 0755)
	os.MkdirAll(capsulesDir, 0755)

	// Create some run records
	runs := []runRecord{
		{
			RunID:    "run-1",
			Policy:   map[string]any{"decision": "allow"},
			EventLog: []map[string]any{{"step": 1}},
		},
		{
			RunID:    "run-2",
			Policy:   map[string]any{"decision": "deny"},
			EventLog: []map[string]any{{"step": 1}},
		},
		{
			RunID:    "run-3",
			Policy:   map[string]any{"decision": "allow"},
			EventLog: []map[string]any{{"step": 1}},
		},
	}

	for _, r := range runs {
		data, _ := json.Marshal(r)
		os.WriteFile(filepath.Join(runsDir, r.RunID+".json"), data, 0644)
	}

	// Create a capsule
	cap := buildCapsule(runs[0])
	data, _ := json.Marshal(cap)
	os.WriteFile(filepath.Join(capsulesDir, "run-1.capsule.json"), data, 0644)

	nodes := []federation.StatusNode{}
	metrics := calculateOperatorMetrics(tmpDir, nodes)

	// Verify metrics
	if metrics.Runs.Total != 3 {
		t.Errorf("expected 3 runs, got %d", metrics.Runs.Total)
	}

	if metrics.Runs.Success != 2 {
		t.Errorf("expected 2 successes, got %d", metrics.Runs.Success)
	}

	if metrics.Runs.Denied != 1 {
		t.Errorf("expected 1 denial, got %d", metrics.Runs.Denied)
	}

	if metrics.Capsules.Total != 1 {
		t.Errorf("expected 1 capsule, got %d", metrics.Capsules.Total)
	}

	if metrics.Health.Overall != "healthy" {
		t.Errorf("expected healthy status, got %s", metrics.Health.Overall)
	}
}

func TestMobileDoctor(t *testing.T) {
	doctor := NewMobileDoctor()

	// Force mobile mode for testing
	os.Setenv("REACH_MOBILE", "1")
	defer os.Unsetenv("REACH_MOBILE")

	report := doctor.Run()

	// Verify report structure
	if report.Summary.Total == 0 {
		t.Error("expected some checks to run")
	}

	// Check that storage check passed (tmpDir is writable)
	foundStorage := false
	for _, check := range report.Checks {
		if check.Name == "Storage" {
			foundStorage = true
			if check.Status != "pass" && check.Status != "warn" {
				t.Errorf("storage check unexpected status: %s", check.Status)
			}
		}
	}

	if !foundStorage {
		t.Error("expected storage check in report")
	}
}

func TestMobileDoctorToHuman(t *testing.T) {
	report := &MobileReport{
		Environment: MobileEnv{
			OS:       "android",
			Arch:     "arm64",
			IsTermux: true,
		},
		Checks: []MobileCheckResult{
			{Name: "Storage", Status: "pass", Message: "OK", Category: "storage"},
			{Name: "Memory", Status: "warn", Message: "Low", Category: "performance"},
		},
		Summary: MobileSummary{
			Pass:    1,
			Warn:    1,
			Overall: "healthy_with_warnings",
		},
		QuickFixes: []string{"Increase memory"},
	}

	output := report.ToHuman()

	// Verify output contains expected elements
	if !strings.Contains(output, "Mobile Health Report") {
		t.Error("expected report header")
	}

	if !strings.Contains(output, "STORAGE") {
		t.Error("expected STORAGE category")
	}

	if !strings.Contains(output, "Quick fixes") {
		t.Error("expected quick fixes section")
	}
}

func TestRunQuick(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("REACH_DATA_DIR", tmpDir)
	defer os.Unsetenv("REACH_DATA_DIR")

	// Setup registry
	registryDir := filepath.Join(tmpDir, "registry")
	os.MkdirAll(registryDir, 0755)
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "quick.test", "spec_version": "1.0"},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(registryDir, "index.json"), data, 0644)

	var out, errOut bytes.Buffer
	code := runQuick([]string{"quick.test", "--input", "mode=test"}, &out, &errOut)

	if code != 0 {
		t.Fatalf("run quick failed: %d, err: %s", code, errOut.String())
	}

	output := out.String()
	if !strings.Contains(output, "quick.test") {
		t.Error("expected pack name in output")
	}

	if !strings.Contains(output, "✓") {
		t.Error("expected success indicator")
	}
}

func TestIntegrationWizardToShare(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	tmpDir := t.TempDir()

	// Setup full environment
	for _, dir := range []string{"runs", "capsules", "registry"} {
		os.MkdirAll(filepath.Join(tmpDir, dir), 0755)
	}

	// Registry
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "integration.test", "spec_version": "1.0", "verified": true},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(tmpDir, "registry", "index.json"), data, 0644)

	// Run wizard
	var wizOut bytes.Buffer
	wizard := NewWizard(tmpDir, &wizOut, &bytes.Buffer{}, true, false)
	wizard.State.SelectedPack = "integration.test"
	wizard.State.Input = map[string]string{"mode": "safe"}

	ctx := context.Background()
	if err := wizard.stepRun(ctx); err != nil {
		t.Fatalf("stepRun failed: %v", err)
	}

	if err := wizard.stepVerify(); err != nil {
		t.Fatalf("stepVerify failed: %v", err)
	}

	if err := wizard.stepShare(); err != nil {
		t.Fatalf("stepShare failed: %v", err)
	}

	// Now share the run
	var shareOut, shareErr bytes.Buffer
	code := shareRun(tmpDir, wizard.State.RunID, &shareOut, &shareErr)

	if code != 0 {
		t.Fatalf("share failed: %d, err: %s", code, shareErr.String())
	}

	// Verify the full flow produced expected outputs
	if wizard.State.CapsulePath == "" {
		t.Error("expected capsule path after wizard")
	}

	if _, err := os.Stat(wizard.State.CapsulePath); os.IsNotExist(err) {
		t.Error("expected capsule file to exist")
	}

	// Verify share output
	shareOutput := shareOut.String()
	if !strings.Contains(shareOutput, "reach://share/") {
		t.Error("expected share URL in output")
	}
}

func BenchmarkWizard(b *testing.B) {
	tmpDir := b.TempDir()

	// Setup
	registryDir := filepath.Join(tmpDir, "registry")
	os.MkdirAll(registryDir, 0755)
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "bench.pack", "spec_version": "1.0"},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(registryDir, "index.json"), data, 0644)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wizard := NewWizard(tmpDir, &bytes.Buffer{}, &bytes.Buffer{}, true, true)
		wizard.Run(ctx)
	}
}
