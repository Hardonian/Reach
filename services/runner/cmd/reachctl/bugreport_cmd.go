package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

type bugreportBundle struct {
	CreatedAt string            `json:"created_at"`
	Version   string            `json:"version"`
	System    map[string]string `json:"system"`
	Doctor    map[string]any    `json:"doctor"`
	Hints     []string          `json:"hints"`
}

func runBugreport(args []string, out, errOut io.Writer) int {
	fs := flag.NewFlagSet("bugreport", flag.ContinueOnError)
	output := fs.String("output", "", "output bundle path")
	_ = fs.Parse(args)

	dataRoot := getenv("REACH_DATA_DIR", "data")
	doctor := collectDoctorSummary(dataRoot)
	bundle := bugreportBundle{
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Version:   engineVersion,
		System: map[string]string{
			"os":       runtime.GOOS,
			"arch":     runtime.GOARCH,
			"go":       runtime.Version(),
			"data_dir": dataRoot,
		},
		Doctor: doctor,
		Hints: []string{
			"Attach this zip to a GitHub issue created from .github/ISSUE_TEMPLATE/bug_report.yml.",
			"Review bugreport.json before sharing to confirm local paths are acceptable.",
		},
	}

	if strings.TrimSpace(*output) == "" {
		stamp := time.Now().UTC().Format("20060102T150405Z")
		*output = filepath.Join(dataRoot, "support", "reach-bugreport-"+stamp+".zip")
	}
	if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to create support directory: %v\n", err)
		return 1
	}

	content, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to render bugreport: %v\n", err)
		return 1
	}

	f, err := os.Create(*output)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to create bundle: %v\n", err)
		return 1
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	if err := writeZipEntry(zw, "bugreport.json", content); err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to write bundle: %v\n", err)
		_ = zw.Close()
		return 1
	}
	if err := zw.Close(); err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to finalize bundle: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]any{
		"bundle": *output,
		"docs":   "https://github.com/reach/reach/blob/main/SUPPORT.md",
	})
}

func collectDoctorSummary(dataRoot string) map[string]any {
	checks := map[string]any{}
	checks["go"] = checkCommand("go", "version")
	checks["node"] = checkCommand("node", "--version")
	checks["npm"] = checkCommand("npm", "--version")
	checks["sqlite3"] = checkCommand("sqlite3", "--version")
	if info, err := os.Stat(dataRoot); err == nil && info.IsDir() {
		checks["data_dir"] = map[string]any{"ok": true, "path": dataRoot}
	} else {
		checks["data_dir"] = map[string]any{"ok": false, "path": dataRoot}
	}
	return checks
}

func checkCommand(name string, args ...string) map[string]any {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	clean := strings.TrimSpace(string(bytes.TrimSpace(output)))
	if err != nil {
		return map[string]any{"ok": false, "message": redactOutput(clean)}
	}
	return map[string]any{"ok": true, "message": redactOutput(clean)}
}

func redactOutput(value string) string {
	if value == "" {
		return value
	}
	parts := strings.Fields(value)
	sort.Strings(parts)
	return strings.Join(parts, " ")
}

func writeZipEntry(zw *zip.Writer, name string, data []byte) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}
