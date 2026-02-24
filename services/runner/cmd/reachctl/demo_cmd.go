package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DemoData represents the demo data structure
type DemoData struct {
	Runs             []DemoRun         `json:"runs"`
	DriftAlerts     []DemoDriftAlert  `json:"drift_alerts"`
	PolicyViolations []DemoViolation   `json:"policy_violations"`
	DecisionItems   []DemoDecision    `json:"decision_items"`
}

// DemoRun represents a demo run
type DemoRun struct {
	RunID           string            `json:"run_id"`
	PackName        string            `json:"pack_name"`
	Status          string            `json:"status"`
	Fingerprint     string            `json:"fingerprint"`
	EventCount      int               `json:"event_count"`
	CreatedAt       string            `json:"created_at"`
}

// DemoDriftAlert represents a drift alert
type DemoDriftAlert struct {
	AlertID     string `json:"alert_id"`
	RunID       string `json:"run_id"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	DetectedAt  string `json:"detected_at"`
}

// DemoViolation represents a policy violation
type DemoViolation struct {
	ViolationID string `json:"violation_id"`
	RunID       string `json:"run_id"`
	PolicyName  string `json:"policy_name"`
	Severity    string `json:"severity"`
	Message     string `json:"message"`
	OccurredAt  string `json:"occurred_at"`
}

// DemoDecision represents a decision item
type DemoDecision struct {
	DecisionID   string         `json:"decision_id"`
	Title        string         `json:"title"`
	Status       string         `json:"status"`
	Priority     string         `json:"priority"`
	Options      []string       `json:"options"`
	Recommended  string         `json:"recommended"`
	CreatedAt    string         `json:"created_at"`
}

// DemoReportBundle represents the exported demo report bundle
type DemoReportBundle struct {
	Manifest DemoReportManifest `json:"manifest"`
	Data     DemoData          `json:"data"`
}

// DemoReportManifest represents the manifest for demo reports
type DemoReportManifest struct {
	BundleID    string `json:"bundle_id"`
	GeneratedAt string `json:"generated_at"`
	Version     string `json:"version"`
	ContentHash string `json:"content_hash"`
}

// runDemo handles demo-related commands
func runDemo(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		return runDemoSmoke(ctx, dataRoot, args, out, errOut)
	}

	switch args[0] {
	case "smoke":
		return runDemoSmoke(ctx, dataRoot, args[1:], out, errOut)
	case "run":
		return runDemoRun(ctx, dataRoot, args[1:], out, errOut)
	case "report":
		return runDemoReport(ctx, dataRoot, args[1:], out, errOut)
	case "status":
		return runDemoStatus(ctx, dataRoot, args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "Usage: reachctl demo <smoke|run|report|status>\n")
		return 1
	}
}

// runDemoSmoke executes one-command time-to-value flow:
// run sample -> create capsule -> verify capsule -> replay capsule.
func runDemoSmoke(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("demo smoke", flag.ContinueOnError)
	packName := fs.String("pack", "arcadeSafe.demo", "pack to run")
	jsonOutput := fs.Bool("json", false, "output as JSON")
	if err := fs.Parse(args); err != nil {
		fmt.Fprintf(errOut, "failed to parse flags: %v\n", err)
		return 1
	}

	var quickOut bytes.Buffer
	if code := runQuick([]string{*packName}, &quickOut, errOut); code != 0 {
		return code
	}

	runID, err := latestRunID(dataRoot)
	if err != nil {
		fmt.Fprintf(errOut, "failed to locate demo run: %v\n", err)
		return 1
	}

	capsulePath := filepath.Join(dataRoot, "capsules", runID+".capsule.json")
	if code := runCapsule(ctx, dataRoot, []string{"create", runID, "--output", capsulePath}, io.Discard, errOut); code != 0 {
		return code
	}

	var verifyOut bytes.Buffer
	if code := runCapsule(ctx, dataRoot, []string{"verify", capsulePath}, &verifyOut, errOut); code != 0 {
		return code
	}
	var verifyPayload map[string]any
	_ = json.Unmarshal(verifyOut.Bytes(), &verifyPayload)
	verified, _ := verifyPayload["verified"].(bool)

	var replayOut bytes.Buffer
	if code := runCapsule(ctx, dataRoot, []string{"replay", capsulePath}, &replayOut, errOut); code != 0 {
		return code
	}
	var replayPayload map[string]any
	_ = json.Unmarshal(replayOut.Bytes(), &replayPayload)
	replayVerified, _ := replayPayload["replay_verified"].(bool)

	result := map[string]any{
		"status":          "ok",
		"pack":            *packName,
		"run_id":          runID,
		"capsule":         capsulePath,
		"verified":        verified,
		"replay_verified": replayVerified,
	}

	if *jsonOutput {
		return writeJSON(out, result)
	}

	fmt.Fprintln(out, "Demo smoke completed.")
	fmt.Fprintf(out, "Run ID: %s\n", runID)
	fmt.Fprintf(out, "Capsule: %s\n", capsulePath)
	fmt.Fprintf(out, "Verified: %t\n", verified)
	fmt.Fprintf(out, "Replay Verified: %t\n", replayVerified)
	return 0
}

// runDemoRun seeds sample data and creates demo runs
func runDemoRun(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("demo run", flag.ContinueOnError)
	_ = fs.Parse(args)

	fmt.Fprintln(out, "Setting up demo environment...")

	// Create demo data
	now := time.Now().UTC()
	demoData := DemoData{
		Runs: []DemoRun{
			{
				RunID:       generateDeterministicID("demo-run-1"),
				PackName:    "hello-deterministic",
				Status:      "completed",
				Fingerprint: "abc123def456",
				EventCount:  10,
				CreatedAt:   now.Add(-2 * time.Hour).Format(time.RFC3339),
			},
			{
				RunID:       generateDeterministicID("demo-run-2"),
				PackName:    "security-basics",
				Status:      "completed",
				Fingerprint: "def456ghi789",
				EventCount:  15,
				CreatedAt:   now.Add(-1 * time.Hour).Format(time.RFC3339),
			},
		},
		DriftAlerts: []DemoDriftAlert{
			{
				AlertID:     generateDeterministicID("drift-alert-1"),
				RunID:       generateDeterministicID("demo-run-2"),
				Severity:    "medium",
				Description: "Detected environment drift between runs",
				DetectedAt:  now.Add(-30 * time.Minute).Format(time.RFC3339),
			},
		},
		PolicyViolations: []DemoViolation{
			{
				ViolationID: generateDeterministicID("violation-1"),
				RunID:       generateDeterministicID("demo-run-2"),
				PolicyName:  "no-external-calls",
				Severity:    "high",
				Message:     "External network call detected",
				OccurredAt:  now.Add(-45 * time.Minute).Format(time.RFC3339),
			},
		},
		DecisionItems: []DemoDecision{
			{
				DecisionID:  generateDeterministicID("decision-1"),
				Title:       "Approve security patch",
				Status:      "pending",
				Priority:    "high",
				Options:     []string{"approve", "reject", "defer"},
				Recommended: "approve",
				CreatedAt:   now.Format(time.RFC3339),
			},
		},
	}

	// Save demo data to file
	demoDataPath := filepath.Join(dataRoot, "demo_data.json")
	data, _ := json.MarshalIndent(demoData, "", "  ")
	os.WriteFile(demoDataPath, data, 0644)

	fmt.Fprintf(out, "Demo data created successfully!\n")
	fmt.Fprintf(out, "- %d runs\n", len(demoData.Runs))
	fmt.Fprintf(out, "- %d drift alerts\n", len(demoData.DriftAlerts))
	fmt.Fprintf(out, "- %d policy violations\n", len(demoData.PolicyViolations))
	fmt.Fprintf(out, "- %d decision items\n", len(demoData.DecisionItems))

	return writeJSON(out, map[string]any{
		"demo_data_path": demoDataPath,
		"runs":           demoData.Runs,
		"drift_alerts":   demoData.DriftAlerts,
		"violations":     demoData.PolicyViolations,
		"decisions":      demoData.DecisionItems,
	})
}

// runDemoReport exports a shareable demo bundle
func runDemoReport(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("demo report", flag.ContinueOnError)
	outputPath := fs.String("output", "", "Output path for the bundle")
	_ = fs.Parse(args)

	// Load demo data
	demoDataPath := filepath.Join(dataRoot, "demo_data.json")
	data, err := os.ReadFile(demoDataPath)
	if err != nil {
		fmt.Fprintf(errOut, "No demo data found. Run 'reachctl demo run' first.\n")
		return 1
	}

	var demoData DemoData
	json.Unmarshal(data, &demoData)

	// Generate bundle
	bundle := DemoReportBundle{
		Manifest: DemoReportManifest{
			BundleID:    generateDeterministicID("demo-bundle"),
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			Version:     "1.0",
			ContentHash: "",
		},
		Data: demoData,
	}

	// Calculate content hash
	contentBytes, _ := json.Marshal(demoData)
	hash := sha256.Sum256(contentBytes)
	bundle.Manifest.ContentHash = hex.EncodeToString(hash[:])

	// Determine output path
	if *outputPath == "" {
		*outputPath = filepath.Join(dataRoot, "demo_report.zip")
	}

	// Create zip bundle
	zipFile, err := os.Create(*outputPath)
	if err != nil {
		fmt.Fprintf(errOut, "Error creating bundle: %v\n", err)
		return 1
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Add manifest.json
	manifestFile, _ := zipWriter.Create("manifest.json")
	manifestBytes, _ := json.MarshalIndent(bundle.Manifest, "", "  ")
	manifestFile.Write(manifestBytes)

	// Add data.json
	dataFile, _ := zipWriter.Create("data.json")
	dataFile.Write(contentBytes)

	fmt.Fprintf(out, "Demo report exported to: %s\n", *outputPath)
	return writeJSON(out, bundle.Manifest)
}

// runDemoStatus shows current demo status
func runDemoStatus(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("demo status", flag.ContinueOnError)
	_ = fs.Parse(args)

	// Check if demo data exists
	demoDataPath := filepath.Join(dataRoot, "demo_data.json")
	_, err := os.ReadFile(demoDataPath)

	if err != nil {
		return writeJSON(out, map[string]any{
			"status":     "not_initialized",
			"message":   "No demo data found. Run 'reachctl demo run' to initialize.",
			"can_export": false,
		})
	}

	var demoData DemoData
	data, _ := os.ReadFile(demoDataPath)
	json.Unmarshal(data, &demoData)

	return writeJSON(out, map[string]any{
		"status":          "initialized",
		"runs_count":      len(demoData.Runs),
		"alerts_count":    len(demoData.DriftAlerts),
		"violations_count": len(demoData.PolicyViolations),
		"decisions_count": len(demoData.DecisionItems),
		"can_export":      true,
	})
}

func latestRunID(dataRoot string) (string, error) {
	runsDir := filepath.Join(dataRoot, "runs")
	entries, err := os.ReadDir(runsDir)
	if err != nil {
		return "", err
	}

	var bestRunID string
	var bestModTime time.Time
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		if info.ModTime().After(bestModTime) {
			bestModTime = info.ModTime()
			bestRunID = strings.TrimSuffix(entry.Name(), ".json")
		}
	}

	if bestRunID == "" {
		return "", fmt.Errorf("no runs found in %s", runsDir)
	}
	return bestRunID, nil
}

// generateDeterministicID generates a deterministic ID based on input
func generateDeterministicID(input string) string {
	data := fmt.Sprintf("%s-%s", input, "2026-01-01")
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:16])
}
