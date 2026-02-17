package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestBuildOutputs(t *testing.T) {
	tmp := t.TempDir()
	src := filepath.Join(tmp, "connector")
	if err := os.MkdirAll(src, 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := `{"kind":"connector","id":"connector-slack","version":"1.2.0","risk_level":"medium","required_capabilities":[],"side_effect_types":[]}`
	if err := os.WriteFile(filepath.Join(src, "manifest.json"), []byte(manifest), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "README.md"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(tmp, "dist")
	cmd := exec.Command("go", "run", ".", "--type", "connector", "--path", src, "--out", out)
	cmd.Dir = "."
	if b, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build failed: %v %s", err, string(b))
	}
	bundleDir := filepath.Join(out, "connector-slack-1.2.0")
	for _, name := range []string{"manifest.json", "bundle.tar.gz", "sha256.txt"} {
		if _, err := os.Stat(filepath.Join(bundleDir, name)); err != nil {
			t.Fatalf("missing %s", name)
		}
	}
}
