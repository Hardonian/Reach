package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadExportBundleRejectsTraversalEntry(t *testing.T) {
	tmpDir := t.TempDir()
	bundlePath := filepath.Join(tmpDir, "bundle.zip")
	writeZipFixture(t, bundlePath, map[string]string{
		"manifest.json": `{"bundle_id":"b1","entity_id":"r1","entity_type":"run","created_at":"2026-01-01T00:00:00Z","content_hash":"h","artifact_count":1,"version":"1.0"}`,
		"../evil.txt":   "not-allowed",
	})

	_, err := readExportBundle(bundlePath)
	if err == nil {
		t.Fatal("expected traversal protection error")
	}
	if !strings.Contains(err.Error(), "path traversal blocked") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestComputeZipHashRejectsTraversalEntry(t *testing.T) {
	tmpDir := t.TempDir()
	zipPath := filepath.Join(tmpDir, "input.zip")
	writeZipFixture(t, zipPath, map[string]string{
		"../escape.txt": "x",
	})

	_, _, err := computeZipHash(zipPath)
	if err == nil {
		t.Fatal("expected traversal protection error")
	}
	if !strings.Contains(err.Error(), "path traversal blocked") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func writeZipFixture(t *testing.T, outPath string, files map[string]string) {
	t.Helper()

	out, err := os.Create(outPath)
	if err != nil {
		t.Fatalf("create zip: %v", err)
	}
	defer out.Close()

	zw := zip.NewWriter(out)
	for name, content := range files {
		w, createErr := zw.Create(name)
		if createErr != nil {
			t.Fatalf("create entry %q: %v", name, createErr)
		}
		if _, writeErr := w.Write([]byte(content)); writeErr != nil {
			t.Fatalf("write entry %q: %v", name, writeErr)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
}

