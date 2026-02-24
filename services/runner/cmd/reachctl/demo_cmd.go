package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func runDemo(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) == 0 {
		return runDemoFlow(ctx, dataRoot, out, errOut)
	}
	if args[0] == "run" {
		return runDemoFlow(ctx, dataRoot, out, errOut)
	}
	if args[0] == "status" {
		return runDemoStatus(dataRoot, out)
	}
	fmt.Fprintf(errOut, "usage: reach demo [run|status]\n")
	return 1
}

func runDemoFlow(ctx context.Context, dataRoot string, out io.Writer, errOut io.Writer) int {
	_ = ctx
	packName := "arcadeSafe.demo"
	_ = os.Remove(filepath.Join(dataRoot, "packs", packName+".json"))
	if code := runQuick([]string{packName}, out, errOut); code != 0 {
		return code
	}

	runID, err := latestRunID(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "failed to locate demo run: %v\n", err)
		return 1
	}

	capsulePath := filepath.Join(dataRoot, "capsules", runID+".capsule.json")
	if code := runCapsule(ctx, dataRoot, []string{"create", runID, "--output", capsulePath}, out, errOut); code != 0 {
		return code
	}
	if code := runCapsule(ctx, dataRoot, []string{"verify", capsulePath}, out, errOut); code != 0 {
		return code
	}
	if code := runCapsule(ctx, dataRoot, []string{"replay", capsulePath}, out, errOut); code != 0 {
		return code
	}
	_, _ = fmt.Fprintf(out, "Demo complete: run=%s capsule=%s\n", runID, capsulePath)
	return 0
}

func runDemoStatus(dataRoot string, out io.Writer) int {
	_, err := latestRunID(dataRoot)
	status := "not_initialized"
	if err == nil {
		status = "ready"
	}
	return writeJSON(out, map[string]any{"status": status})
}

func latestRunID(dataRoot string) (string, error) {
	entries, err := os.ReadDir(filepath.Join(dataRoot, "runs"))
	if err != nil {
		return "", err
	}
	latest := ""
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		if entry.Name() > latest {
			latest = entry.Name()
		}
	}
	if latest == "" {
		return "", fmt.Errorf("no runs found")
	}
	return strings.TrimSuffix(latest, ".json"), nil
}

func parseDemoFlags(args []string) {
	fs := flag.NewFlagSet("demo", flag.ContinueOnError)
	_ = fs.Parse(args)
}
