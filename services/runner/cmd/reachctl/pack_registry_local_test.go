package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestPackRegistryAddListAndLockfile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("REACH_DATA_DIR", tmp)

	packDir := filepath.Join(tmp, "src-pack")
	if err := os.MkdirAll(packDir, 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := map[string]any{
		"name":        "local.test.pack",
		"version":     "1.0.0",
		"description": "local test pack",
		"compatibility": map[string]any{
			"reach_version_range":  ">=0.1.0,<=0.9.0",
			"schema_version_range": ">=1.0.0,<=1.0.0",
		},
	}
	b, _ := json.Marshal(manifest)
	if err := os.WriteFile(filepath.Join(packDir, "pack.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}

	var out, errOut bytes.Buffer
	if code := runPackRegistry(context.Background(), []string{"add", packDir}, &out, &errOut); code != 0 {
		t.Fatalf("add failed: %d %s", code, errOut.String())
	}
	if _, err := os.Stat(filepath.Join(tmp, "registry", "pack.lock.json")); err != nil {
		t.Fatalf("expected lockfile: %v", err)
	}
	out.Reset()
	errOut.Reset()
	if code := runPackRegistry(context.Background(), []string{"list"}, &out, &errOut); code != 0 {
		t.Fatalf("list failed: %d %s", code, errOut.String())
	}
	if !bytes.Contains(out.Bytes(), []byte("local.test.pack")) {
		t.Fatalf("expected pack in list output: %s", out.String())
	}
}

func TestPackCompatibilityRejected(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("REACH_DATA_DIR", tmp)

	packDir := filepath.Join(tmp, "bad-pack")
	if err := os.MkdirAll(packDir, 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := map[string]any{
		"name":    "bad.compat.pack",
		"version": "1.0.0",
		"compatibility": map[string]any{
			"reach_version_range": ">=9.0.0",
		},
	}
	b, _ := json.Marshal(manifest)
	if err := os.WriteFile(filepath.Join(packDir, "pack.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}

	var out, errOut bytes.Buffer
	if code := runPackRegistry(context.Background(), []string{"add", packDir}, &out, &errOut); code == 0 {
		t.Fatalf("expected compatibility failure")
	}
}

func TestScanPackNonDeterministicAPIs(t *testing.T) {
	tmp := t.TempDir()
	if err := os.WriteFile(filepath.Join(tmp, "script.js"), []byte("const x = Date.now();"), 0o644); err != nil {
		t.Fatal(err)
	}
	hits, err := scanPackNonDeterministicAPIs(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) == 0 {
		t.Fatalf("expected forbidden api hit")
	}
}
