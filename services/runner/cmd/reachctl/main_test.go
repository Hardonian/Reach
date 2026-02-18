package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func seedRun(t *testing.T, root, runID string) {
	t.Helper()
	data := `{"run_id":"` + runID + `","pack":{"name":"arcadeSafe.demo","signature":"sig"},"policy":{"decision":"allow","reason":"capability approved"},"registry_snapshot_hash":"abc","event_log":[{"step":"start"},{"step":"end"}],"federation_path":["node-a","node-b"],"trust_scores":{"node-a":98},"audit_chain":["e1","e2"],"environment":{"os":"linux"}}`
	path := filepath.Join(root, "runs", runID+".json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
}

func runCmd(t *testing.T, root string, args ...string) (int, string) {
	t.Helper()
	_ = os.Setenv("REACH_DATA_DIR", root)
	var out bytes.Buffer
	code := run(t.Context(), args, &out, &out)
	return code, out.String()
}

func TestCapsuleCreateVerifyReplay(t *testing.T) {
	root := t.TempDir()
	seedRun(t, root, "r1")
	code, out := runCmd(t, root, "capsule", "create", "r1")
	if code != 0 || !strings.Contains(out, "fingerprint") {
		t.Fatalf("create failed: %d %s", code, out)
	}
	capsule := filepath.Join(root, "capsules", "r1.capsule.json")
	code, out = runCmd(t, root, "capsule", "verify", capsule)
	if code != 0 || !strings.Contains(out, `"verified": true`) {
		t.Fatalf("verify failed: %d %s", code, out)
	}
	code, out = runCmd(t, root, "capsule", "replay", capsule)
	if code != 0 || !strings.Contains(out, `"replay_verified": true`) {
		t.Fatalf("replay failed: %d %s", code, out)
	}
}

func TestProofVerify(t *testing.T) {
	root := t.TempDir()
	seedRun(t, root, "r2")
	code, out := runCmd(t, root, "proof", "verify", "r2")
	if code != 0 || !strings.Contains(out, `"deterministic": true`) {
		t.Fatalf("proof failed: %d %s", code, out)
	}
}

func TestPackRegistryVerify(t *testing.T) {
	root := t.TempDir()
	code, out := runCmd(t, root, "packs", "verify", "arcadeSafe.demo")
	if code != 0 || !strings.Contains(out, `"verified": true`) {
		t.Fatalf("pack verify failed: %d %s", code, out)
	}
}

func TestGovernedTemplateOutput(t *testing.T) {
	cwd, _ := os.Getwd()
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	root := t.TempDir()
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	code, _ := runCmd(t, root, "init", "pack", "--governed")
	if code != 0 {
		t.Fatalf("init failed")
	}
	required := []string{"governed-pack/pack.json", "governed-pack/policy.rego", "governed-pack/tests/conformance_test.sh", "governed-pack/tests/replay_determinism_test.sh"}
	for _, p := range required {
		if _, err := os.Stat(filepath.Join(root, p)); err != nil {
			t.Fatalf("missing %s", p)
		}
	}
}

func TestExplainSafety(t *testing.T) {
	root := t.TempDir()
	seedRun(t, root, "r3")
	code, out := runCmd(t, root, "explain", "r3")
	if code != 0 {
		t.Fatalf("explain failed: %s", out)
	}
	lower := strings.ToLower(out)
	if strings.Contains(lower, "bypass") || strings.Contains(lower, "secret") {
		t.Fatalf("unsafe explain output: %s", out)
	}
}

func TestArenaDeterminism(t *testing.T) {
	root := t.TempDir()
	_, out1 := runCmd(t, root, "arena", "run", "s1")
	_, out2 := runCmd(t, root, "arena", "run", "s1")
	if out1 != out2 {
		t.Fatalf("arena output not deterministic")
	}
}

func TestOperatorSmoke(t *testing.T) {
	root := t.TempDir()
	code, out := runCmd(t, root, "operator")
	if code != 0 {
		t.Fatalf("operator failed: %s", out)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(out), &body); err != nil {
		t.Fatalf("operator output invalid json: %v", err)
	}
}
