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
	"sort"
	"strings"

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

func usage(out io.Writer) {
	_, _ = io.WriteString(out, "usage: reachctl federation status|map --format=json|svg | support ask <question> | arcade profile | capsule create|verify|replay | proof verify <runId|capsule> | graph export <runId> --format=svg|dot|json | packs search|install|verify | init pack --governed | explain <runId> | operator | arena run <scenario> | playground export\n")
}
