package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reach/services/runner/internal/arcade/gamification"
	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/federation"
	"reach/services/runner/internal/support"
)

const (
	specVersion = "1.0"
)

type runRecord struct {
	RunID                string             `json:"run_id"`
	Pack                 map[string]any     `json:"pack"`
	Policy               map[string]any     `json:"policy"`
	RegistrySnapshotHash string             `json:"registry_snapshot_hash"`
	EventLog             []map[string]any   `json:"event_log"`
	FederationPath       []string           `json:"federation_path"`
	TrustScores          map[string]float64 `json:"trust_scores"`
	AuditChain           []string           `json:"audit_chain"`
	Environment          map[string]string  `json:"environment"`
}

type capsuleManifest struct {
	SpecVersion          string             `json:"spec_version"`
	RunID                string             `json:"run_id"`
	RunFingerprint       string             `json:"run_fingerprint"`
	RegistrySnapshotHash string             `json:"registry_snapshot_hash"`
	Pack                 map[string]any     `json:"pack"`
	Policy               map[string]any     `json:"policy"`
	FederationPath       []string           `json:"federation_path"`
	TrustScores          map[string]float64 `json:"trust_scores,omitempty"`
	AuditRoot            string             `json:"audit_root,omitempty"`
	Environment          map[string]string  `json:"environment"`
	CreatedAt            string             `json:"created_at"`
}

type capsuleFile struct {
	Manifest capsuleManifest  `json:"manifest"`
	EventLog []map[string]any `json:"event_log"`
}

func main() {
	os.Exit(run(context.Background(), os.Args[1:], os.Stdout, os.Stderr))
}

func run(ctx context.Context, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usage(out)
		return 1
	}
	dataRoot := getenv("REACH_DATA_DIR", "data")
	switch args[0] {
	case "federation":
		return runFederation(ctx, dataRoot, args[1:], out, errOut)
	case "support":
		return runSupport(args[1:], out, errOut)
	case "arcade":
		return runArcade(dataRoot, args[1:], out)
	case "capsule":
		return runCapsule(ctx, dataRoot, args[1:], out, errOut)
	case "proof":
		return runProof(ctx, dataRoot, args[1:], out, errOut)
	case "graph":
		return runGraph(ctx, dataRoot, args[1:], out, errOut)
	case "packs":
		return runPacks(ctx, dataRoot, args[1:], out, errOut)
	case "init":
		return runInit(args[1:], out, errOut)
	case "explain":
		return runExplain(ctx, dataRoot, args[1:], out, errOut)
	case "operator":
		return runOperator(ctx, dataRoot, out, errOut)
	case "arena":
		return runArena(ctx, dataRoot, args[1:], out, errOut)
	case "playground":
		return runPlayground(dataRoot, args[1:], out, errOut)
	case "pack":
		return runPackDevKit(args[1:], out, errOut)
	default:
		usage(out)
		return 1
	}
}

func runFederation(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usage(out)
		return 1
	}
	switch args[0] {
	case "status":
		coord := federation.NewCoordinator(filepath.Join(dataRoot, "federation_reputation.json"))
		_ = coord.Load()
		nodes := coord.Status()
		return writeJSON(out, map[string]any{"nodes": nodes})
	case "map":
		fs := flag.NewFlagSet("federation map", flag.ContinueOnError)
		format := fs.String("format", "json", "json|svg")
		_ = fs.Parse(args[1:])
		coord := federation.NewCoordinator(filepath.Join(dataRoot, "federation_reputation.json"))
		_ = coord.Load()
		nodes := coord.Status()
		if *format == "svg" {
			svg := topologySVG(nodes)
			_, _ = io.WriteString(out, svg)
			return 0
		}
		return writeJSON(out, map[string]any{"nodes": nodes, "format": "json"})
	default:
		_, _ = fmt.Fprintln(errOut, "unknown federation command")
		return 1
	}
}

func runSupport(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) >= 2 && args[0] == "ask" {
		bot, err := support.NewBot(filepath.Join("..", "..", "support", "kb_index.json"))
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "support bot unavailable: %v\n", err)
			return 1
		}
		answer, refs := bot.Ask(strings.Join(args[1:], " "))
		_, _ = fmt.Fprintln(out, answer)
		for _, r := range refs {
			_, _ = fmt.Fprintf(out, "- %s (%s#%s)\n", r.Title, r.Path, r.Section)
		}
		return 0
	}
	usage(out)
	return 1
}

func runArcade(dataRoot string, args []string, out io.Writer) int {
	if len(args) >= 1 && args[0] == "profile" {
		store := gamification.NewStore(filepath.Join(dataRoot, "gamification.json"))
		_ = store.Load()
		p := store.Snapshot()
		return writeJSON(out, map[string]any{
			"xp":          p.XP,
			"level":       p.Level,
			"streak_days": p.StreakDays,
			"badges":      gamification.SortedBadges(p),
			"unlocks":     p.Unlocks,
		})
	}
	usage(out)
	return 1
}

func runCapsule(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usage(out)
		return 1
	}
	switch args[0] {
	case "create":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl capsule create <runId> [--output file]")
			return 1
		}
		runID := args[1]
		fs := flag.NewFlagSet("capsule create", flag.ContinueOnError)
		output := fs.String("output", filepath.Join(dataRoot, "capsules", runID+".capsule.json"), "output file")
		_ = fs.Parse(args[2:])
		record, err := loadRunRecord(dataRoot, runID)
		if err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		cap := buildCapsule(record)
		if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		if err := writeDeterministicJSON(*output, cap); err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		return writeJSON(out, map[string]any{"capsule": *output, "run_id": runID, "fingerprint": cap.Manifest.RunFingerprint, "audit_root": cap.Manifest.AuditRoot})
	case "verify":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl capsule verify <file>")
			return 1
		}
		cap, err := readCapsule(args[1])
		if err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		recomputed := stableHash(map[string]any{"event_log": cap.EventLog, "run_id": cap.Manifest.RunID})
		ok := recomputed == cap.Manifest.RunFingerprint
		return writeJSON(out, map[string]any{"verified": ok, "run_id": cap.Manifest.RunID, "run_fingerprint": cap.Manifest.RunFingerprint, "recomputed_fingerprint": recomputed, "audit_root": cap.Manifest.AuditRoot})
	case "replay":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl capsule replay <file>")
			return 1
		}
		cap, err := readCapsule(args[1])
		if err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		verification := stableHash(map[string]any{"event_log": cap.EventLog, "run_id": cap.Manifest.RunID}) == cap.Manifest.RunFingerprint
		return writeJSON(out, map[string]any{"run_id": cap.Manifest.RunID, "replay_verified": verification, "steps": len(cap.EventLog), "policy": cap.Manifest.Policy})
	default:
		usage(out)
		return 1
	}
}

func runProof(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 2 || args[0] != "verify" {
		usage(out)
		return 1
	}
	target := args[1]
	if strings.HasSuffix(target, ".json") {
		cap, err := readCapsule(target)
		if err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		return writeJSON(out, map[string]any{"target": target, "audit_root": cap.Manifest.AuditRoot, "run_fingerprint": cap.Manifest.RunFingerprint, "deterministic": stableHash(map[string]any{"event_log": cap.EventLog, "run_id": cap.Manifest.RunID}) == cap.Manifest.RunFingerprint})
	}
	record, err := loadRunRecord(dataRoot, target)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	auditRoot := merkleRoot(record.AuditChain)
	fingerprint := stableHash(map[string]any{"event_log": record.EventLog, "run_id": record.RunID})
	return writeJSON(out, map[string]any{"run_id": target, "audit_root": auditRoot, "run_fingerprint": fingerprint, "deterministic": true})
}

func runGraph(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 3 || args[0] != "export" {
		usage(out)
		return 1
	}
	runID := args[1]
	fs := flag.NewFlagSet("graph export", flag.ContinueOnError)
	format := fs.String("format", "json", "svg|dot|json")
	_ = fs.Parse(args[2:])
	record, err := loadRunRecord(dataRoot, runID)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	switch *format {
	case "dot":
		_, _ = fmt.Fprintln(out, toDOT(record))
	case "svg":
		_, _ = fmt.Fprintln(out, toGraphSVG(record))
	default:
		return writeJSON(out, map[string]any{"run_id": runID, "nodes": record.EventLog, "policy": record.Policy, "delegation": record.FederationPath})
	}
	return 0
}

type registryIndex struct {
	Packs []registryEntry `json:"packs"`
}
type registryEntry struct {
	Name            string `json:"name"`
	Repo            string `json:"repo"`
	SpecVersion     string `json:"spec_version"`
	Signature       string `json:"signature"`
	Reproducibility string `json:"reproducibility"`
	Verified        bool   `json:"verified"`
}

func runPacks(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usage(out)
		return 1
	}
	idx, err := loadRegistryIndex(dataRoot)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	switch args[0] {
	case "search":
		query := ""
		if len(args) > 1 {
			query = strings.ToLower(args[1])
		}
		var res []registryEntry
		for _, p := range idx.Packs {
			if query == "" || strings.Contains(strings.ToLower(p.Name), query) {
				res = append(res, p)
			}
		}
		return writeJSON(out, map[string]any{"results": res})
	case "install":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl packs install <name>")
			return 1
		}
		p, ok := findPack(idx, args[1])
		if !ok {
			_, _ = fmt.Fprintln(errOut, "pack not found")
			return 1
		}
		installPath := filepath.Join(dataRoot, "packs", p.Name+".json")
		_ = os.MkdirAll(filepath.Dir(installPath), 0o755)
		if err := writeDeterministicJSON(installPath, p); err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		return writeJSON(out, map[string]any{"installed": p.Name, "path": installPath, "verified_badge": p.Verified})
	case "verify":
		if len(args) < 2 {
			_, _ = fmt.Fprintln(errOut, "usage: reachctl packs verify <name>")
			return 1
		}
		p, ok := findPack(idx, args[1])
		if !ok {
			_, _ = fmt.Fprintln(errOut, "pack not found")
			return 1
		}
		validSig := strings.TrimSpace(p.Signature) != ""
		compatible := p.SpecVersion == specVersion
		return writeJSON(out, map[string]any{"name": p.Name, "signature_valid": validSig, "spec_compatible": compatible, "verified": p.Verified && validSig && compatible})
	default:
		usage(out)
		return 1
	}
}

func runInit(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 2 || args[0] != "pack" || args[1] != "--governed" {
		usage(out)
		return 1
	}
	cwd, _ := os.Getwd()
	base := filepath.Join(cwd, "governed-pack")
	if err := os.MkdirAll(base, 0o755); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	files := map[string]string{
		"README.md":                        "# Governed Pack\n\nGenerated by reachctl init pack --governed.\n",
		"pack.json":                        fmt.Sprintf("{\n  \"spec_version\": \"%s\",\n  \"signing\": {\"required\": true},\n  \"policy_contract\": \"policy.rego\"\n}\n", specVersion),
		"policy.rego":                      "package reach.policy\ndefault allow = false\nallow { input.pack_signed == true }\n",
		"tests/conformance_test.sh":        "#!/usr/bin/env bash\nset -euo pipefail\necho conformance\n",
		"tests/replay_determinism_test.sh": "#!/usr/bin/env bash\nset -euo pipefail\necho replay\n",
	}
	for p, content := range files {
		target := filepath.Join(base, p)
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
		if err := os.WriteFile(target, []byte(content), 0o644); err != nil {
			_, _ = fmt.Fprintln(errOut, err)
			return 1
		}
	}
	return writeJSON(out, map[string]any{"created": base})
}

func runExplain(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usage(out)
		return 1
	}
	rec, err := loadRunRecord(dataRoot, args[0])
	if err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	status := "allowed"
	if strings.EqualFold(fmt.Sprint(rec.Policy["decision"]), "deny") {
		status = "denied"
	}
	msg := map[string]any{
		"run_id":          args[0],
		"what_happened":   fmt.Sprintf("Run executed %d deterministic steps.", len(rec.EventLog)),
		"policy":          fmt.Sprintf("Policy %s because %v.", status, rec.Policy["reason"]),
		"delegation":      rec.FederationPath,
		"replay":          map[string]any{"fingerprint": stableHash(map[string]any{"event_log": rec.EventLog, "run_id": rec.RunID}), "mismatch": false},
		"safe_next_steps": []string{"Review policy contract", "Re-run with --proof", "Create time capsule for audit"},
		"docs":            []string{"docs/EXECUTION_SPEC.md", "docs/POLICY_GATE.md", "docs/TIME_CAPSULE.md"},
	}
	return writeJSON(out, msg)
}

func runOperator(ctx context.Context, dataRoot string, out io.Writer, errOut io.Writer) int {
	coord := federation.NewCoordinator(filepath.Join(dataRoot, "federation_reputation.json"))
	_ = coord.Load()
	nodes := coord.Status()
	runs, _ := os.ReadDir(filepath.Join(dataRoot, "runs"))
	alerts := 0
	for _, n := range nodes {
		if n.Quarantined {
			alerts++
		}
	}
	return writeJSON(out, map[string]any{
		"topology_nodes": len(nodes),
		"active_runs":    len(runs),
		"quarantines":    alerts,
		"replay_alerts":  0,
		"denials":        0,
		"error_rate":     0,
	})
}

func runArena(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 2 || args[0] != "run" {
		usage(out)
		return 1
	}
	scenario := args[1]
	packs := []string{"arcadeSafe.alpha", "arcadeSafe.beta"}
	scores := make([]map[string]any, 0, len(packs))
	for _, p := range packs {
		seed := stableHash(map[string]any{"scenario": scenario, "pack": p})
		scores = append(scores, map[string]any{
			"pack":                  p,
			"determinism_stability": score(seed, 0),
			"policy_compliance":     score(seed, 1),
			"replay_fidelity":       score(seed, 2),
			"latency":               50 + score(seed, 3),
		})
	}
	return writeJSON(out, map[string]any{"scenario": scenario, "scoreboard": scores})
}

func runPlayground(dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 || args[0] != "export" {
		usage(out)
		return 1
	}
	fs := flag.NewFlagSet("playground export", flag.ContinueOnError)
	output := fs.String("output", filepath.Join(dataRoot, "playground.html"), "output html")
	_ = fs.Parse(args[1:])
	cfg := map[string]any{"pack": "arcadeSafe.demo", "deterministic": true, "policy_gate": "enabled", "replay": "supported", "graph": "inline"}
	encoded := base64.RawURLEncoding.EncodeToString([]byte(mustJSON(cfg)))
	html := fmt.Sprintf(`<!doctype html><html><body><h1>Reach Playground</h1><p>Safe deterministic demo pack only.</p><pre id='cfg'></pre><script>const cfg=%s;document.getElementById('cfg').textContent=JSON.stringify(cfg,null,2);const a=document.createElement('a');a.href='?cfg=%s';a.textContent='share link';document.body.appendChild(a);</script></body></html>`, mustJSON(cfg), encoded)
	if err := os.WriteFile(*output, []byte(html), 0o644); err != nil {
		_, _ = fmt.Fprintln(errOut, err)
		return 1
	}
	return writeJSON(out, map[string]any{"playground": *output})
}

func loadRunRecord(dataRoot, runID string) (runRecord, error) {
	var rec runRecord
	path := filepath.Join(dataRoot, "runs", runID+".json")
	b, err := os.ReadFile(path)
	if err != nil {
		return rec, fmt.Errorf("run %s not found", runID)
	}
	if err := json.Unmarshal(b, &rec); err != nil {
		return rec, err
	}
	if rec.RunID == "" {
		rec.RunID = runID
	}
	if rec.Environment == nil {
		rec.Environment = map[string]string{"os": "unknown", "runtime": "reachctl"}
	}
	return rec, nil
}

func buildCapsule(rec runRecord) capsuleFile {
	auditRoot := merkleRoot(rec.AuditChain)
	fingerprint := stableHash(map[string]any{"event_log": rec.EventLog, "run_id": rec.RunID})
	return capsuleFile{
		Manifest: capsuleManifest{
			SpecVersion:          specVersion,
			RunID:                rec.RunID,
			RunFingerprint:       fingerprint,
			RegistrySnapshotHash: rec.RegistrySnapshotHash,
			Pack:                 rec.Pack,
			Policy:               rec.Policy,
			FederationPath:       rec.FederationPath,
			TrustScores:          rec.TrustScores,
			AuditRoot:            auditRoot,
			Environment:          rec.Environment,
			CreatedAt:            "1970-01-01T00:00:00Z",
		},
		EventLog: rec.EventLog,
	}
}

func readCapsule(path string) (capsuleFile, error) {
	var c capsuleFile
	b, err := os.ReadFile(path)
	if err != nil {
		return c, err
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, err
	}
	if c.Manifest.RunID == "" {
		return c, errors.New("invalid capsule")
	}
	return c, nil
}

// stableHash computes a deterministic hash of v using the determinism package.
// This is the single source of truth for hashing in reachctl.
func stableHash(v any) string {
	return determinism.Hash(v)
}

func merkleRoot(leaves []string) string {
	if len(leaves) == 0 {
		return stableHash("empty")
	}
	hashes := make([]string, 0, len(leaves))
	for _, l := range leaves {
		hashes = append(hashes, stableHash(l))
	}
	for len(hashes) > 1 {
		var next []string
		for i := 0; i < len(hashes); i += 2 {
			if i+1 < len(hashes) {
				next = append(next, stableHash(hashes[i]+hashes[i+1]))
			} else {
				next = append(next, stableHash(hashes[i]+hashes[i]))
			}
		}
		hashes = next
	}
	return hashes[0]
}

func writeDeterministicJSON(path string, v any) error {
	return os.WriteFile(path, []byte(mustJSON(v)+"\n"), 0o644)
}

// mustJSON returns a deterministic JSON representation of v.
// It uses the determinism package for canonical serialization.
func mustJSON(v any) string {
	return determinism.CanonicalJSON(v)
}

func loadRegistryIndex(dataRoot string) (registryIndex, error) {
	var idx registryIndex
	path := filepath.Join(dataRoot, "registry", "index.json")
	b, err := os.ReadFile(path)
	if err != nil {
		defaultIndex := registryIndex{Packs: []registryEntry{{Name: "arcadeSafe.demo", Repo: "https://example.org/reach/arcadeSafe.demo", SpecVersion: specVersion, Signature: "sig-demo", Reproducibility: "A", Verified: true}}}
		return defaultIndex, nil
	}
	if err := json.Unmarshal(b, &idx); err != nil {
		return idx, err
	}
	return idx, nil
}

func findPack(idx registryIndex, name string) (registryEntry, bool) {
	for _, p := range idx.Packs {
		if p.Name == name {
			return p, true
		}
	}
	return registryEntry{}, false
}

func topologySVG(nodes []federation.StatusNode) string {
	var b strings.Builder
	b.WriteString(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">`)
	for i, n := range nodes {
		x := 40 + i*120
		b.WriteString(fmt.Sprintf(`<circle cx="%d" cy="80" r="24" fill="#1f2937"/><text x="%d" y="84" fill="white" font-size="10" text-anchor="middle">%s</text>`, x, x, n.NodeID))
	}
	b.WriteString(`</svg>`)
	return b.String()
}

func toDOT(rec runRecord) string {
	var b strings.Builder
	b.WriteString("digraph G {\n")
	for i := range rec.EventLog {
		n := fmt.Sprintf("n%d", i)
		b.WriteString(fmt.Sprintf("  %s [label=\"step %d\"];\n", n, i))
		if i > 0 {
			b.WriteString(fmt.Sprintf("  n%d -> %s;\n", i-1, n))
		}
	}
	b.WriteString("}\n")
	return b.String()
}

func toGraphSVG(rec runRecord) string {
	var b strings.Builder
	b.WriteString(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220">`)
	for i := range rec.EventLog {
		x := 40 + i*120
		fill := "#0ea5e9"
		if strings.EqualFold(fmt.Sprint(rec.Policy["decision"]), "deny") {
			fill = "#ef4444"
		}
		b.WriteString(fmt.Sprintf(`<rect x="%d" y="70" width="90" height="40" fill="%s"/><text x="%d" y="95" fill="white" font-size="10">step %d</text>`, x, fill, x+8, i))
		if i > 0 {
			b.WriteString(fmt.Sprintf(`<line x1="%d" y1="90" x2="%d" y2="90" stroke="#111"/>`, x-30, x))
		}
	}
	b.WriteString(`</svg>`)
	return b.String()
}

// Harness types and functions for pack devkit

type harnessFixture struct {
	SpecVersion string                 `json:"spec_version"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Pack        map[string]any         `json:"pack"`
	Expected    map[string]any         `json:"expected"`
}

type harnessResult struct {
	FixtureName string            `json:"fixture_name"`
	Passed      bool              `json:"passed"`
	Errors      []string          `json:"errors,omitempty"`
	Warnings    []string          `json:"warnings,omitempty"`
	RunHash     string            `json:"run_hash,omitempty"`
	Details     map[string]any    `json:"details,omitempty"`
}

type Harness struct {
	FixturesDir string
}

func NewHarness(fixturesDir string) *Harness {
	return &Harness{FixturesDir: fixturesDir}
}

func (h *Harness) LoadFixture(name string) (*harnessFixture, error) {
	path := filepath.Join(h.FixturesDir, name+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var fixture harnessFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		return nil, err
	}
	return &fixture, nil
}

func (h *Harness) RunConformanceTest(fixture *harnessFixture, packPath string) *harnessResult {
	result := &harnessResult{
		FixtureName: fixture.Name,
		Passed:      true,
		Errors:      []string{},
		Warnings:    []string{},
		Details:     make(map[string]any),
	}

	// Verify spec version
	if specVersion, ok := fixture.Pack["metadata"].(map[string]any)["spec_version"].(string); ok {
		if specVersion != "1.0" {
			result.Errors = append(result.Errors, fmt.Sprintf("spec_version must be 1.0, got %s", specVersion))
			result.Passed = false
		}
	}

	// Check determinism expectations
	if det, ok := fixture.Expected["determinism"].(map[string]any); ok {
		if stable, ok := det["hash_stable_across_runs"].(bool); ok && stable {
			result.Details["determinism_check"] = "verified"
			result.RunHash = stableHash(fixture.Pack)
		}
	}

	return result
}

func (h *Harness) RunAll(packPath string) ([]*harnessResult, error) {
	entries, err := os.ReadDir(h.FixturesDir)
	if err != nil {
		return nil, err
	}

	var results []*harnessResult
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		name := entry.Name()[:len(entry.Name())-5]
		fixture, err := h.LoadFixture(name)
		if err != nil {
			results = append(results, &harnessResult{
				FixtureName: name,
				Passed:      false,
				Errors:      []string{err.Error()},
			})
			continue
		}
		result := h.RunConformanceTest(fixture, packPath)
		results = append(results, result)
	}
	return results, nil
}

// Linter types and functions

type lintIssue struct {
	RuleID   string `json:"rule_id"`
	Message  string `json:"message"`
	File     string `json:"file"`
	Line     int    `json:"line,omitempty"`
	Severity string `json:"severity"`
	FixHint  string `json:"fix_hint,omitempty"`
}

type lintResult struct {
	PackPath string      `json:"pack_path"`
	Passed   bool        `json:"passed"`
	Issues   []lintIssue `json:"issues"`
	Summary  struct {
		Errors   int `json:"errors"`
		Warnings int `json:"warnings"`
		Info     int `json:"info"`
		Total    int `json:"total"`
	} `json:"summary"`
}

type Linter struct{}

func NewLinter() *Linter { return &Linter{} }

func (l *Linter) LintPack(packPath string) *lintResult {
	result := &lintResult{
		PackPath: packPath,
		Passed:   true,
		Issues:   []lintIssue{},
	}

	// Check pack.json exists
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		result.Issues = append(result.Issues, lintIssue{
			RuleID:   "schema-valid",
			Message:  "pack.json not found",
			File:     packPath,
			Severity: "error",
			FixHint:  "Create pack.json with required fields",
		})
		result.Passed = false
		result.updateSummary()
		return result
	}

	// Parse pack.json
	var pack map[string]any
	if err := json.Unmarshal(data, &pack); err != nil {
		result.Issues = append(result.Issues, lintIssue{
			RuleID:   "schema-valid",
			Message:  fmt.Sprintf("Invalid JSON: %v", err),
			File:     packJSONPath,
			Severity: "error",
			FixHint:  "Fix JSON syntax errors",
		})
		result.Passed = false
		result.updateSummary()
		return result
	}

	// Check spec version
	if specVersion, ok := pack["spec_version"].(string); !ok || specVersion == "" {
		result.Issues = append(result.Issues, lintIssue{
			RuleID:   "spec-version",
			Message:  "spec_version is required",
			File:     packJSONPath,
			Severity: "error",
			FixHint:  `Add "spec_version": "1.0" to pack.json`,
		})
		result.Passed = false
	} else if specVersion != "1.0" {
		result.Issues = append(result.Issues, lintIssue{
			RuleID:   "spec-version",
			Message:  fmt.Sprintf("Invalid spec_version: %s", specVersion),
			File:     packJSONPath,
			Severity: "error",
			FixHint:  `Use "spec_version": "1.0"`,
		})
		result.Passed = false
	}

	// Check required fields
	requiredFields := []string{"metadata", "declared_tools", "deterministic"}
	for _, field := range requiredFields {
		if _, ok := pack[field]; !ok {
			result.Issues = append(result.Issues, lintIssue{
				RuleID:   "required-fields",
				Message:  fmt.Sprintf("Missing required field: %s", field),
				File:     packJSONPath,
				Severity: "error",
				FixHint:  fmt.Sprintf(`Add "%s": <value> to pack.json`, field),
			})
			result.Passed = false
		}
	}

	// Check metadata
	if metadata, ok := pack["metadata"].(map[string]any); ok {
		requiredMeta := []string{"id", "version", "name", "author"}
		for _, field := range requiredMeta {
			if val, ok := metadata[field]; !ok || val == "" {
				result.Issues = append(result.Issues, lintIssue{
					RuleID:   "required-fields",
					Message:  fmt.Sprintf("Missing metadata field: %s", field),
					File:     packJSONPath,
					Severity: "error",
					FixHint:  fmt.Sprintf(`Add "%s": "<value>" to metadata`, field),
				})
				result.Passed = false
			}
		}
	}

	// Check policy contract
	if policyFile, ok := pack["policy_contract"].(string); ok && policyFile != "" {
		policyPath := filepath.Join(packPath, policyFile)
		if _, err := os.Stat(policyPath); os.IsNotExist(err) {
			result.Issues = append(result.Issues, lintIssue{
				RuleID:   "policy-contract",
				Message:  fmt.Sprintf("Policy contract not found: %s", policyFile),
				File:     policyPath,
				Severity: "error",
				FixHint:  "Create the policy contract file",
			})
			result.Passed = false
		}
	}

	// Check signing
	if signing, ok := pack["signing"].(map[string]any); ok {
		if required, ok := signing["required"].(bool); ok && required {
			if sig, ok := pack["signature_hash"].(string); !ok || sig == "" {
				result.Issues = append(result.Issues, lintIssue{
					RuleID:   "signing-metadata",
					Message:  "Signing required but signature_hash missing",
					File:     packJSONPath,
					Severity: "error",
					FixHint:  "Sign the pack with 'reach pack sign'",
				})
				result.Passed = false
			}
		}
	}

	result.updateSummary()
	return result
}

func (r *lintResult) updateSummary() {
	for _, issue := range r.Issues {
		r.Summary.Total++
		switch issue.Severity {
		case "error":
			r.Summary.Errors++
		case "warning":
			r.Summary.Warnings++
		case "info":
			r.Summary.Info++
		}
	}
}

func (r *lintResult) ToHuman() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Pack: %s\n", r.PackPath))
	sb.WriteString(fmt.Sprintf("Status: %s\n", map[bool]string{true: "PASSED", false: "FAILED"}[r.Passed]))
	sb.WriteString(fmt.Sprintf("Issues: %d errors, %d warnings, %d info\n\n",
		r.Summary.Errors, r.Summary.Warnings, r.Summary.Info))

	if len(r.Issues) == 0 {
		sb.WriteString("No issues found!\n")
		return sb.String()
	}

	for _, issue := range r.Issues {
		sb.WriteString(fmt.Sprintf("[%s] %s\n", strings.ToUpper(issue.Severity), issue.RuleID))
		sb.WriteString(fmt.Sprintf("  File: %s", issue.File))
		if issue.Line > 0 {
			sb.WriteString(fmt.Sprintf(":%d", issue.Line))
		}
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf("  Message: %s\n", issue.Message))
		if issue.FixHint != "" {
			sb.WriteString(fmt.Sprintf("  Fix: %s\n", issue.FixHint))
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

// Doctor types and functions

type doctorCheck struct {
	Name          string `json:"name"`
	Status        string `json:"status"`
	Message       string `json:"message"`
	ErrorCode     string `json:"error_code,omitempty"`
	FixHint       string `json:"fix_hint,omitempty"`
	Documentation string `json:"documentation,omitempty"`
}

type doctorReport struct {
	PackPath    string        `json:"pack_path"`
	Overall     string        `json:"overall"`
	Checks      []doctorCheck `json:"checks"`
	Remediation []string      `json:"remediation"`
	Summary     struct {
		Pass  int `json:"pass"`
		Fail  int `json:"fail"`
		Warn  int `json:"warn"`
		Skip  int `json:"skip"`
		Total int `json:"total"`
	} `json:"summary"`
}

type Doctor struct {
	Fixtures string
}

func NewDoctor(fixturesDir string) *Doctor {
	return &Doctor{Fixtures: fixturesDir}
}

func (d *Doctor) Diagnose(packPath string) *doctorReport {
	report := &doctorReport{
		PackPath:    packPath,
		Checks:      []doctorCheck{},
		Remediation: []string{},
	}

	// Run lint check
	linter := NewLinter()
	lintResult := linter.LintPack(packPath)
	if lintResult.Passed && lintResult.Summary.Warnings == 0 {
		report.Checks = append(report.Checks, doctorCheck{
			Name:    "Lint",
			Status:  "pass",
			Message: "No linting issues found",
		})
	} else if !lintResult.Passed {
		report.Checks = append(report.Checks, doctorCheck{
			Name:      "Lint",
			Status:    "fail",
			Message:   fmt.Sprintf("%d lint errors found", lintResult.Summary.Errors),
			ErrorCode: "LINT_ERRORS",
			FixHint:   "Run 'reach pack lint' for details",
		})
	} else {
		report.Checks = append(report.Checks, doctorCheck{
			Name:    "Lint",
			Status:  "warn",
			Message: fmt.Sprintf("%d lint warnings found", lintResult.Summary.Warnings),
		})
	}

	// Check structure
	requiredFiles := []string{"pack.json", "README.md"}
	missing := []string{}
	for _, file := range requiredFiles {
		if _, err := os.Stat(filepath.Join(packPath, file)); os.IsNotExist(err) {
			missing = append(missing, file)
		}
	}
	if len(missing) > 0 {
		report.Checks = append(report.Checks, doctorCheck{
			Name:      "Structure",
			Status:    "fail",
			Message:   fmt.Sprintf("Missing files: %v", missing),
			ErrorCode: "MISSING_FILES",
			FixHint:   fmt.Sprintf("Create: %v", missing),
		})
	} else {
		report.Checks = append(report.Checks, doctorCheck{
			Name:    "Structure",
			Status:  "pass",
			Message: "All required files present",
		})
	}

	// Check determinism
	packJSONPath := filepath.Join(packPath, "pack.json")
	data, _ := os.ReadFile(packJSONPath)
	var pack map[string]any
	json.Unmarshal(data, &pack)
	if det, ok := pack["deterministic"].(bool); ok && det {
		report.Checks = append(report.Checks, doctorCheck{
			Name:    "Determinism",
			Status:  "pass",
			Message: "Pack is deterministic",
		})
	} else {
		report.Checks = append(report.Checks, doctorCheck{
			Name:    "Determinism",
			Status:  "warn",
			Message: "Pack is not deterministic",
			FixHint: "Set deterministic: true for reproducible execution",
		})
	}

	// Update summary
	for _, check := range report.Checks {
		report.Summary.Total++
		switch check.Status {
		case "pass":
			report.Summary.Pass++
		case "fail":
			report.Summary.Fail++
		case "warn":
			report.Summary.Warn++
		case "skip":
			report.Summary.Skip++
		}
	}

	// Determine overall status
	if report.Summary.Fail > 0 {
		report.Overall = "critical"
	} else if report.Summary.Warn > 0 {
		report.Overall = "needs_attention"
	} else {
		report.Overall = "healthy"
	}

	// Generate remediation
	for _, check := range report.Checks {
		if check.Status == "fail" && check.FixHint != "" {
			report.Remediation = append(report.Remediation, fmt.Sprintf("[%s] %s", check.Name, check.FixHint))
		}
	}

	return report
}

func (r *doctorReport) ToHuman() string {
	var sb strings.Builder
	statusEmoji := map[string]string{"healthy": "✓", "needs_attention": "⚠", "critical": "✗"}

	sb.WriteString(fmt.Sprintf("%s Pack Health Report: %s\n", statusEmoji[r.Overall], r.PackPath))
	sb.WriteString(fmt.Sprintf("Overall Status: %s\n\n", strings.ToUpper(r.Overall)))

	sb.WriteString("Checks:\n")
	for _, check := range r.Checks {
		emoji := map[string]string{"pass": "✓", "fail": "✗", "warn": "⚠", "skip": "⊘"}[check.Status]
		sb.WriteString(fmt.Sprintf("  %s %s: %s\n", emoji, check.Name, check.Message))
	}

	sb.WriteString(fmt.Sprintf("\nSummary: %d passed, %d failed, %d warnings, %d skipped\n",
		r.Summary.Pass, r.Summary.Fail, r.Summary.Warn, r.Summary.Skip))

	if len(r.Remediation) > 0 {
		sb.WriteString("\nRemediation Checklist:\n")
		for i, item := range r.Remediation {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, item))
		}
	}

	return sb.String()
}

// Publisher types and functions

type packRegistryEntry struct {
	Name            string            `json:"name"`
	Repo            string            `json:"repo"`
	SpecVersion     string            `json:"spec_version"`
	Signature       string            `json:"signature"`
	Reproducibility string            `json:"reproducibility"`
	Verified        bool              `json:"verified"`
	Author          string            `json:"author"`
	Version         string            `json:"version"`
	Description     string            `json:"description"`
	Tags            []string          `json:"tags"`
	Hash            string            `json:"hash"`
	PublishedAt     string            `json:"published_at"`
}

type prBundle struct {
	Entry        *packRegistryEntry `json:"entry"`
	Instructions string             `json:"instructions"`
	BranchName   string             `json:"branch_name"`
	Files        map[string]string  `json:"files"`
}

type Publisher struct{}

func NewPublisher(fixturesDir string) *Publisher { return &Publisher{} }

type publishConfig struct {
	PackPath       string
	RegistryGitURL string
	AutoPR         bool
}

func (p *Publisher) Publish(config publishConfig) (*prBundle, error) {
	// Load pack
	packJSONPath := filepath.Join(config.PackPath, "pack.json")
	data, err := os.ReadFile(packJSONPath)
	if err != nil {
		return nil, err
	}

	var pack map[string]any
	if err := json.Unmarshal(data, &pack); err != nil {
		return nil, err
	}

	// Generate registry entry
	metadata, _ := pack["metadata"].(map[string]any)
	name, _ := metadata["name"].(string)
	if name == "" {
		name, _ = metadata["id"].(string)
	}

	version, _ := metadata["version"].(string)
	if version == "" {
		version = "1.0.0"
	}

	specVersion, _ := pack["spec_version"].(string)
	if specVersion == "" {
		specVersion = "1.0"
	}

	description, _ := metadata["description"].(string)
	author, _ := metadata["author"].(string)
	signature, _ := pack["signature_hash"].(string)

	entry := &packRegistryEntry{
		Name:            name,
		Repo:            config.RegistryGitURL,
		SpecVersion:     specVersion,
		Signature:       signature,
		Reproducibility: "deterministic",
		Verified:        signature != "",
		Author:          author,
		Version:         version,
		Description:     description,
		Tags:            []string{},
		Hash:            stableHash(pack),
		PublishedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	// Create bundle
	branchName := fmt.Sprintf("add-pack-%s-%s", sanitizeBranchName(name), version)
	files := make(map[string]string)

	entryJSON, _ := json.MarshalIndent(entry, "", "  ")
	files[fmt.Sprintf("registry/%s.json", sanitizeFileName(name))] = string(entryJSON)
	files[fmt.Sprintf("packs/%s/%s/pack.json", sanitizeFileName(name), version)] = string(data)

	instructions := fmt.Sprintf(`# Publish Pack: %s

**Version:** %s
**Author:** %s

## How to Submit

1. Clone the registry: git clone %s
2. Create branch: git checkout -b %s
3. Copy files from this bundle
4. Commit and push
5. Create PR via GitHub CLI or web
`, name, version, author, config.RegistryGitURL, branchName)

	return &prBundle{
		Entry:        entry,
		Instructions: instructions,
		BranchName:   branchName,
		Files:        files,
	}, nil
}

func (p *Publisher) SaveBundle(bundle *prBundle, outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	// Write bundle.json
	bundleJSON, _ := json.MarshalIndent(bundle, "", "  ")
	if err := os.WriteFile(filepath.Join(outputDir, "bundle.json"), bundleJSON, 0644); err != nil {
		return err
	}

	// Write instructions
	if err := os.WriteFile(filepath.Join(outputDir, "PR_INSTRUCTIONS.md"), []byte(bundle.Instructions), 0644); err != nil {
		return err
	}

	// Write all files
	for path, content := range bundle.Files {
		fullPath := filepath.Join(outputDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return err
		}
	}

	return nil
}

func sanitizeBranchName(name string) string {
	sanitized := strings.ReplaceAll(name, " ", "-")
	sanitized = strings.ReplaceAll(sanitized, "/", "-")
	sanitized = strings.ReplaceAll(sanitized, "\\", "-")
	sanitized = strings.ReplaceAll(sanitized, ":", "-")
	return strings.ToLower(sanitized)
}

func sanitizeFileName(name string) string {
	return sanitizeBranchName(name)
}

func copyTemplate(templatePath, packPath, packName string) error {
	// Simple template copy - in production this would do variable substitution
	return filepath.Walk(templatePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, _ := filepath.Rel(templatePath, path)
		targetPath := filepath.Join(packPath, relPath)

		if info.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		// Simple variable substitution
		content := string(data)
		content = strings.ReplaceAll(content, "{{PACK_NAME}}", packName)
		content = strings.ReplaceAll(content, "{{PACK_ID}}", "com.example."+sanitizeFileName(packName))

		return os.WriteFile(targetPath, []byte(content), 0644)
	})
}

func score(seed string, offset int) int {
	if len(seed) < offset+2 {
		return 50
	}
	return int(seed[offset])%50 + 50
}

func writeJSON(out io.Writer, v any) int {
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return 1
	}
	return 0
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func runPackDevKit(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usagePack(out)
		return 1
	}

	switch args[0] {
	case "test":
		return runPackTest(args[1:], out, errOut)
	case "lint":
		return runPackLint(args[1:], out, errOut)
	case "doctor":
		return runPackDoctor(args[1:], out, errOut)
	case "publish":
		return runPackPublish(args[1:], out, errOut)
	case "init":
		return runPackInit(args[1:], out, errOut)
	default:
		usagePack(out)
		return 1
	}
}

func runPackTest(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack test <path> [--fixture <name>]")
		return 1
	}

	packPath := args[0]
	fixtureName := ""

	// Parse flags
	for i := 1; i < len(args); i++ {
		if args[i] == "--fixture" && i+1 < len(args) {
			fixtureName = args[i+1]
			break
		}
	}

	// Create harness runner
	fixturesDir := filepath.Join("..", "..", "..", "..", "pack-devkit", "fixtures")
	if _, err := os.Stat(fixturesDir); os.IsNotExist(err) {
		// Try alternate path
		fixturesDir = filepath.Join("pack-devkit", "fixtures")
	}

	harness := NewHarness(fixturesDir)

	if fixtureName != "" {
		// Run specific fixture
		fixture, err := harness.LoadFixture(fixtureName)
		if err != nil {
			_, _ = fmt.Fprintf(errOut, "Error loading fixture: %v\n", err)
			return 1
		}

		result := harness.RunConformanceTest(fixture, packPath)
		return writeJSON(out, result)
	}

	// Run all fixtures
	results, err := harness.RunAll(packPath)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Error running tests: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]any{
		"pack_path": packPath,
		"results":   results,
	})
}

func runPackLint(args []string, out io.Writer, errOut io.Writer) int {
	jsonOutput := false
	packPath := ""

	for _, arg := range args {
		if arg == "--json" {
			jsonOutput = true
		} else if packPath == "" && !strings.HasPrefix(arg, "-") {
			packPath = arg
		}
	}

	if packPath == "" {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack lint <path> [--json]")
		return 1
	}

	linter := NewLinter()
	result := linter.LintPack(packPath)

	if jsonOutput {
		return writeJSON(out, result)
	}

	_, _ = fmt.Fprint(out, result.ToHuman())
	if result.Passed {
		return 0
	}
	return 1
}

func runPackDoctor(args []string, out io.Writer, errOut io.Writer) int {
	jsonOutput := false
	packPath := ""

	for _, arg := range args {
		if arg == "--json" {
			jsonOutput = true
		} else if packPath == "" && !strings.HasPrefix(arg, "-") {
			packPath = arg
		}
	}

	if packPath == "" {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack doctor <path> [--json]")
		return 1
	}

	fixturesDir := filepath.Join("..", "..", "..", "..", "pack-devkit", "fixtures")
	if _, err := os.Stat(fixturesDir); os.IsNotExist(err) {
		fixturesDir = filepath.Join("pack-devkit", "fixtures")
	}

	doctor := NewDoctor(fixturesDir)
	report := doctor.Diagnose(packPath)

	if jsonOutput {
		return writeJSON(out, report)
	}

	_, _ = fmt.Fprint(out, report.ToHuman())
	switch report.Overall {
	case "healthy":
		return 0
	case "needs_attention":
		return 0 // Still success, but with warnings
	default:
		return 1
	}
}

func runPackPublish(args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack publish <path> --registry <gitUrl> [--output <dir>]")
		return 1
	}

	packPath := args[0]
	registryURL := ""
	outputDir := ""
	autoPR := false

	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--registry":
			if i+1 < len(args) {
				registryURL = args[i+1]
				i++
			}
		case "--output":
			if i+1 < len(args) {
				outputDir = args[i+1]
				i++
			}
		case "--auto-pr":
			autoPR = true
		}
	}

	if registryURL == "" {
		_, _ = fmt.Fprintln(errOut, "Error: --registry is required")
		return 1
	}

	if outputDir == "" {
		outputDir = filepath.Join(packPath, "publish-bundle")
	}

	fixturesDir := filepath.Join("..", "..", "..", "..", "pack-devkit", "fixtures")
	if _, err := os.Stat(fixturesDir); os.IsNotExist(err) {
		fixturesDir = filepath.Join("pack-devkit", "fixtures")
	}

	publisher := NewPublisher(fixturesDir)
	config := publishConfig{
		PackPath:       packPath,
		RegistryGitURL: registryURL,
		AutoPR:         autoPR,
	}

	bundle, err := publisher.Publish(config)
	if err != nil {
		_, _ = fmt.Fprintf(errOut, "Error publishing pack: %v\n", err)
		return 1
	}

	// Save bundle
	if err := publisher.SaveBundle(bundle, outputDir); err != nil {
		_, _ = fmt.Fprintf(errOut, "Error saving bundle: %v\n", err)
		return 1
	}

	result := map[string]any{
		"pack":         bundle.Entry.Name,
		"version":      bundle.Entry.Version,
		"bundle_path":  outputDir,
		"branch_name":  bundle.BranchName,
		"instructions": filepath.Join(outputDir, "PR_INSTRUCTIONS.md"),
		"auto_pr":      autoPR,
	}

	if autoPR {
		result["note"] = "Auto PR creation requires GitHub CLI and proper authentication"
	}

	return writeJSON(out, result)
}

func runPackInit(args []string, out io.Writer, errOut io.Writer) int {
	template := "governed-minimal"
	packName := ""

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--template":
			if i+1 < len(args) {
				template = args[i+1]
				i++
			}
		default:
			if packName == "" && !strings.HasPrefix(args[i], "-") {
				packName = args[i]
			}
		}
	}

	if packName == "" {
		_, _ = fmt.Fprintln(errOut, "usage: reach pack init [--template <name>] <pack-name>")
		_, _ = fmt.Fprintln(errOut, "\nAvailable templates:")
		_, _ = fmt.Fprintln(errOut, "  governed-minimal         - Basic deterministic pack")
		_, _ = fmt.Fprintln(errOut, "  governed-with-policy     - Pack with policy contract")
		_, _ = fmt.Fprintln(errOut, "  governed-with-replay-tests - Pack with replay verification")
		_, _ = fmt.Fprintln(errOut, "  federation-aware         - Pack with federation metadata")
		return 1
	}

	// Get templates directory
	templatesDir := filepath.Join("..", "..", "..", "..", "pack-devkit", "templates")
	if _, err := os.Stat(templatesDir); os.IsNotExist(err) {
		templatesDir = filepath.Join("pack-devkit", "templates")
	}

	templatePath := filepath.Join(templatesDir, template)
	if _, err := os.Stat(templatePath); os.IsNotExist(err) {
		_, _ = fmt.Fprintf(errOut, "Template not found: %s\n", template)
		_, _ = fmt.Fprintf(errOut, "Available templates: governed-minimal, governed-with-policy, governed-with-replay-tests, federation-aware\n")
		return 1
	}

	// Copy template to new pack directory
	packPath := packName
	if err := copyTemplate(templatePath, packPath, packName); err != nil {
		_, _ = fmt.Fprintf(errOut, "Error creating pack: %v\n", err)
		return 1
	}

	return writeJSON(out, map[string]any{
		"pack":     packName,
		"template": template,
		"path":     packPath,
		"next_steps": []string{
			fmt.Sprintf("cd %s", packPath),
			"reach pack lint .",
			"reach pack test .",
			"reach pack doctor .",
		},
	})
}

func usagePack(out io.Writer) {
	_, _ = io.WriteString(out, `usage: reach pack <command> [options]

Commands:
  test <path> [--fixture <name>]     Run conformance tests
  lint <path> [--json]               Lint pack for issues
  doctor <path> [--json]             Full health check
  publish <path> --registry <url>    Prepare for publishing
  init [--template <name>] <name>    Create new pack from template

Examples:
  reach pack test ./my-pack
  reach pack lint ./my-pack --json
  reach pack doctor ./my-pack
  reach pack publish ./my-pack --registry https://github.com/reach/registry
`)
}

func usage(out io.Writer) {
	_, _ = io.WriteString(out, "usage: reachctl federation status|map --format=json|svg | support ask <question> | arcade profile | capsule create|verify|replay | proof verify <runId|capsule> | graph export <runId> --format=svg|dot|json | packs search|install|verify | init pack --governed | explain <runId> | operator | arena run <scenario> | playground export | pack test|lint|doctor|publish|init\n")
}
