package main

import (
	"archive/zip"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"reach/services/runner/internal/determinism"
)

// Artifact types supported by ingest
const (
	ArtifactTypeRunBundle = "run-bundle"
	ArtifactTypeProof     = "proof"
	ArtifactTypeDiff      = "diff"
	ArtifactTypeDecision  = "decision"
	ArtifactTypeLogs      = "logs"
	ArtifactTypeCapsule   = "capsule"
)

// ArtifactRecord represents an ingested artifact
type ArtifactRecord struct {
	ArtifactID  string         `json:"artifact_id"`
	Type        string         `json:"type"`
	ContentHash string         `json:"content_hash"`
	Size        int64          `json:"size"`
	Metadata    map[string]any `json:"metadata"`
	IndexedAt   string         `json:"indexed_at"`
	SourcePath  string         `json:"source_path"`
}

// ArtifactExportBundle represents an exportable bundle
type ArtifactExportBundle struct {
	Manifest   ExportManifest    `json:"manifest"`
	Artifacts  []ArtifactFileRef `json:"artifacts"`
	ProofChain []string          `json:"proof_chain"`
}

// ExportManifest is the manifest for exported bundles
type ExportManifest struct {
	BundleID      string `json:"bundle_id"`
	EntityID      string `json:"entity_id"`
	EntityType    string `json:"entity_type"`
	CreatedAt     string `json:"created_at"`
	ContentHash   string `json:"content_hash"`
	ArtifactCount int    `json:"artifact_count"`
	Version       string `json:"version"`
}

// ArtifactFileRef references an artifact file in the bundle
type ArtifactFileRef struct {
	Name        string `json:"name"`
	ContentHash string `json:"content_hash"`
	Size        int64  `json:"size"`
}

// runArtifact handles artifact-related commands: ingest, export, verify
func runArtifact(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		usageArtifact(out)
		return 1
	}

	switch args[0] {
	case "ingest":
		return runArtifactIngest(ctx, dataRoot, args[1:], out, errOut)
	case "export":
		return runArtifactExport(ctx, dataRoot, args[1:], out, errOut)
	case "verify":
		return runArtifactVerify(ctx, dataRoot, args[1:], out, errOut)
	case "list":
		return runArtifactList(ctx, dataRoot, args[1:], out, errOut)
	default:
		usageArtifact(out)
		return 1
	}
}

// runArtifactIngest handles 'reachctl artifact ingest <path>'
func runArtifactIngest(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl artifact ingest <path|zip|url> [--type type] [--json]")
		return 1
	}

	sourcePath := args[0]
	fs := flag.NewFlagSet("artifact ingest", flag.ContinueOnError)
	artifactType := fs.String("type", "", "artifact type (run-bundle, proof, diff, decision, logs, capsule)")
	jsonOutput := fs.Bool("json", false, "output as JSON")
	_ = fs.Parse(args[1:])

	// Determine artifact type if not specified
	if *artifactType == "" {
		*artifactType = detectArtifactType(sourcePath)
	}

	// Create artifacts directory
	artifactsDir := filepath.Join(dataRoot, "artifacts")
	if err := os.MkdirAll(artifactsDir, 0o755); err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to create artifacts directory:", err)
		return 1
	}

	// Read and hash the source
	contentHash, size, err := computeContentHash(sourcePath)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to read source:", err)
		return 1
	}

	// Generate deterministic artifact ID based on content hash
	artifactID := deterministicArtifactID(contentHash)

	// Store the artifact with content-hash key
	artifactPath := filepath.Join(artifactsDir, contentHash[:16]+".artifact")
	if _, err := os.Stat(artifactPath); os.IsNotExist(err) {
		if err := copyFile(sourcePath, artifactPath); err != nil {
			_, _ = fmt.Fprintln(errOut, "failed to store artifact:", err)
			return 1
		}
	}

	// Build metadata
	metadata := map[string]any{
		"source_path":   sourcePath,
		"detected_type": detectArtifactType(sourcePath),
	}

	// Create artifact record
	record := ArtifactRecord{
		ArtifactID:  artifactID,
		Type:        *artifactType,
		ContentHash: contentHash,
		Size:        size,
		Metadata:    metadata,
		IndexedAt:   time.Now().UTC().Format(time.RFC3339),
		SourcePath:  sourcePath,
	}

	// Save artifact index
	indexPath := filepath.Join(artifactsDir, "index.json")
	artifacts := loadArtifactIndex(indexPath)
	artifacts[artifactID] = record
	if err := saveArtifactIndex(indexPath, artifacts); err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to save index:", err)
		return 1
	}

	if *jsonOutput {
		return writeJSON(out, map[string]any{
			"artifact_id":  artifactID,
			"type":         *artifactType,
			"content_hash": contentHash,
			"size":         size,
			"indexed_at":   record.IndexedAt,
		})
	}

	_, _ = fmt.Fprintf(out, "Artifact ingested: %s\n", artifactID)
	_, _ = fmt.Fprintf(out, "Type: %s\n", *artifactType)
	_, _ = fmt.Fprintf(out, "Content Hash: %s\n", contentHash)
	_, _ = fmt.Fprintf(out, "Size: %d bytes\n", size)
	return 0
}

// runArtifactExport handles 'reachctl artifact export <entityId>'
func runArtifactExport(_ context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl artifact export <entityId> [--output file.zip]")
		return 1
	}

	entityID := args[0]
	fs := flag.NewFlagSet("artifact export", flag.ContinueOnError)
	output := fs.String("output", filepath.Join(dataRoot, "exports", entityID+".zip"), "output zip file")
	jsonOutput := fs.Bool("json", false, "output as JSON")
	_ = fs.Parse(args[1:])

	// Determine entity type and load data
	entityType, data, err := loadEntityData(dataRoot, entityID)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to load entity:", err)
		return 1
	}

	// Create export bundle
	bundle := createExportBundle(entityID, entityType, data)

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to create output directory:", err)
		return 1
	}

	// Write bundle to zip
	if err := writeExportBundle(*output, bundle); err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to write bundle:", err)
		return 1
	}

	// Compute bundle hash
	bundleHash := determinism.Hash(map[string]any{
		"manifest":  bundle.Manifest,
		"artifacts": bundle.Artifacts,
	})

	if *jsonOutput {
		return writeJSON(out, map[string]any{
			"bundle":         *output,
			"entity_id":      entityID,
			"entity_type":    entityType,
			"bundle_hash":    bundleHash,
			"artifact_count": len(bundle.Artifacts),
		})
	}

	_, _ = fmt.Fprintf(out, "Bundle exported: %s\n", *output)
	_, _ = fmt.Fprintf(out, "Entity: %s (%s)\n", entityID, entityType)
	_, _ = fmt.Fprintf(out, "Bundle Hash: %s\n", bundleHash)
	_, _ = fmt.Fprintf(out, "Artifacts: %d\n", len(bundle.Artifacts))
	return 0
}

// runArtifactVerify handles 'reachctl artifact verify <bundle.zip>'
func runArtifactVerify(_ context.Context, _ string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		_, _ = fmt.Fprintln(errOut, "usage: reachctl artifact verify <bundle.zip> [--json]")
		return 1
	}

	bundlePath := args[0]
	fs := flag.NewFlagSet("artifact verify", flag.ContinueOnError)
	jsonOutput := fs.Bool("json", false, "output as JSON")
	_ = fs.Parse(args[1:])

	// Open and verify the bundle
	bundle, err := readExportBundle(bundlePath)
	if err != nil {
		_, _ = fmt.Fprintln(errOut, "failed to read bundle:", err)
		return 1
	}

	// Verify each artifact
	verified := true
	var verificationErrors []string

	for _, art := range bundle.Artifacts {
		// In a full implementation, we'd verify each artifact's hash
		// For now, we verify the bundle structure
		if art.ContentHash == "" {
			verified = false
			verificationErrors = append(verificationErrors, fmt.Sprintf("missing hash for artifact: %s", art.Name))
		}
	}

	// Verify manifest integrity
	expectedHash := determinism.Hash(map[string]any{
		"manifest":  bundle.Manifest,
		"artifacts": bundle.Artifacts,
	})

	if expectedHash != bundle.Manifest.ContentHash {
		verified = false
		verificationErrors = append(verificationErrors, "manifest hash mismatch")
	}

	if *jsonOutput {
		return writeJSON(out, map[string]any{
			"verified":       verified,
			"bundle_path":    bundlePath,
			"entity_id":      bundle.Manifest.EntityID,
			"entity_type":    bundle.Manifest.EntityType,
			"manifest_hash":  bundle.Manifest.ContentHash,
			"expected_hash":  expectedHash,
			"artifact_count": len(bundle.Artifacts),
			"errors":         verificationErrors,
		})
	}

	if verified {
		_, _ = fmt.Fprintf(out, "✓ Bundle verified: %s\n", bundlePath)
		_, _ = fmt.Fprintf(out, "  Entity: %s (%s)\n", bundle.Manifest.EntityID, bundle.Manifest.EntityType)
		_, _ = fmt.Fprintf(out, "  Artifacts: %d\n", len(bundle.Artifacts))
	} else {
		_, _ = fmt.Fprintf(out, "✗ Verification failed: %s\n", bundlePath)
		for _, err := range verificationErrors {
			_, _ = fmt.Fprintf(out, "  - %s\n", err)
		}
	}
	return map[bool]int{true: 0, false: 1}[verified]
}

// runArtifactList handles 'reachctl artifact list'
func runArtifactList(_ context.Context, dataRoot string, args []string, out io.Writer, _ io.Writer) int {
	fs := flag.NewFlagSet("artifact list", flag.ContinueOnError)
	jsonOutput := fs.Bool("json", false, "output as JSON")
	filterType := fs.String("type", "", "filter by type")
	_ = fs.Parse(args)

	indexPath := filepath.Join(dataRoot, "artifacts", "index.json")
	artifacts := loadArtifactIndex(indexPath)

	// Filter by type if specified
	var filtered []ArtifactRecord
	for _, art := range artifacts {
		if *filterType == "" || art.Type == *filterType {
			filtered = append(filtered, art)
		}
	}

	// Sort by indexed time (newest first)
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].IndexedAt > filtered[j].IndexedAt
	})

	if *jsonOutput {
		return writeJSON(out, map[string]any{
			"artifacts": filtered,
			"total":     len(filtered),
		})
	}

	_, _ = fmt.Fprintf(out, "Total artifacts: %d\n", len(filtered))
	for _, art := range filtered {
		_, _ = fmt.Fprintf(out, "  %s | %s | %s | %d bytes\n", art.ArtifactID[:12], art.Type, art.IndexedAt, art.Size)
	}
	return 0
}

// Helper functions

func usageArtifact(out io.Writer) {
	_, _ = fmt.Fprintln(out, "usage: reachctl artifact <command>")
	_, _ = fmt.Fprintln(out, "")
	_, _ = fmt.Fprintln(out, "Commands:")
	_, _ = fmt.Fprintln(out, "  ingest <path>    - Ingest artifact from path, zip, or url")
	_, _ = fmt.Fprintln(out, "  export <entity>  - Export entity as bundle zip")
	_, _ = fmt.Fprintln(out, "  verify <bundle>  - Verify bundle integrity")
	_, _ = fmt.Fprintln(out, "  list             - List ingested artifacts")
	_, _ = fmt.Fprintln(out, "")
	_, _ = fmt.Fprintln(out, "Examples:")
	_, _ = fmt.Fprintln(out, "  reachctl artifact ingest ./my-run.capsule.json")
	_, _ = fmt.Fprintln(out, "  reachctl artifact export run-12345")
	_, _ = fmt.Fprintln(out, "  reachctl artifact verify bundle.zip")
	_, _ = fmt.Fprintln(out, "  reachctl artifact list --type capsule")
}

func detectArtifactType(path string) string {
	lower := strings.ToLower(path)
	switch {
	case strings.Contains(lower, "capsule"):
		return ArtifactTypeCapsule
	case strings.Contains(lower, "proof"):
		return ArtifactTypeProof
	case strings.Contains(lower, "diff"):
		return ArtifactTypeDiff
	case strings.Contains(lower, "decision"):
		return ArtifactTypeDecision
	case strings.Contains(lower, "log"):
		return ArtifactTypeLogs
	case strings.HasSuffix(lower, ".zip"):
		return ArtifactTypeRunBundle
	default:
		return ArtifactTypeRunBundle
	}
}

func computeContentHash(path string) (string, int64, error) {
	// Handle URLs (placeholder - would need HTTP client)
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return "", 0, fmt.Errorf("URL support not yet implemented")
	}

	// Handle zip files - compute hash of contents
	if strings.HasSuffix(strings.ToLower(path), ".zip") {
		return computeZipHash(path)
	}

	// Regular file
	data, err := os.ReadFile(path)
	if err != nil {
		return "", 0, err
	}
	hash := determinism.Hash(string(data))
	return hash, int64(len(data)), nil
}

func computeZipHash(path string) (string, int64, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return "", 0, err
	}
	defer r.Close()

	var totalSize int64
	var contents []string

	// Read all files and sort for deterministic ordering
	var files []string
	for _, f := range r.File {
		files = append(files, f.Name)
	}
	sort.Strings(files)

	for _, name := range files {
		// Find the file in the zip
		var targetFile *zip.File
		for _, f := range r.File {
			if f.Name == name {
				targetFile = f
				break
			}
		}
		if targetFile == nil {
			continue
		}

		f, err := targetFile.Open()
		if err != nil {
			return "", 0, err
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			return "", 0, err
		}
		contents = append(contents, name+":"+string(data))
		totalSize += int64(len(data))
	}

	hash := determinism.Hash(strings.Join(contents, "|"))
	return hash, totalSize, nil
}

func deterministicArtifactID(contentHash string) string {
	return "art_" + contentHash[:16]
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

func loadArtifactIndex(path string) map[string]ArtifactRecord {
	data, err := os.ReadFile(path)
	if err != nil {
		return make(map[string]ArtifactRecord)
	}

	var records map[string]ArtifactRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return make(map[string]ArtifactRecord)
	}
	return records
}

func saveArtifactIndex(path string, artifacts map[string]ArtifactRecord) error {
	data, err := json.MarshalIndent(artifacts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func loadEntityData(dataRoot, entityID string) (string, map[string]any, error) {
	// Try to load as a run
	runPath := filepath.Join(dataRoot, "runs", entityID+".json")
	if data, err := os.ReadFile(runPath); err == nil {
		var record map[string]any
		if err := json.Unmarshal(data, &record); err == nil {
			return "run", record, nil
		}
	}

	// Try to load as a capsule
	capsulePath := filepath.Join(dataRoot, "capsules", entityID+".capsule.json")
	if data, err := os.ReadFile(capsulePath); err == nil {
		var record map[string]any
		if err := json.Unmarshal(data, &record); err == nil {
			return "capsule", record, nil
		}
	}

	return "", nil, fmt.Errorf("entity not found: %s", entityID)
}

func createExportBundle(entityID, entityType string, data map[string]any) *ArtifactExportBundle {
	// Get event log for proof chain
	eventLog := []map[string]any{}
	if events, ok := data["event_log"].([]map[string]any); ok {
		eventLog = events
	}

	// Build proof chain
	proofChain := []string{}
	if fp, ok := data["fingerprint"].(string); ok {
		proofChain = append(proofChain, fp)
	}
	if len(eventLog) > 0 {
		proofChain = append(proofChain, determinism.Hash(eventLog))
	}

	// Create manifest
	manifest := ExportManifest{
		BundleID:      "bundle_" + entityID + "_" + time.Now().UTC().Format("20060102150405"),
		EntityID:      entityID,
		EntityType:    entityType,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
		ContentHash:   determinism.Hash(data),
		ArtifactCount: 1,
		Version:       "1.0",
	}

	// Create artifact references
	artifacts := []ArtifactFileRef{
		{
			Name:        entityType + ".json",
			ContentHash: determinism.Hash(data),
			Size:        int64(len(fmt.Sprint(data))),
		},
	}

	return &ArtifactExportBundle{
		Manifest:   manifest,
		Artifacts:  artifacts,
		ProofChain: proofChain,
	}
}

func writeExportBundle(path string, bundle *ArtifactExportBundle) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	zipWriter := zip.NewWriter(f)
	defer zipWriter.Close()

	// Write manifest
	manifestData, _ := json.MarshalIndent(bundle.Manifest, "", "  ")
	manifestFile, err := zipWriter.Create("manifest.json")
	if err != nil {
		return err
	}
	_, _ = manifestFile.Write(manifestData)

	// Write artifacts
	for _, art := range bundle.Artifacts {
		artFile, err := zipWriter.Create(art.Name)
		if err != nil {
			return err
		}
		// In a real implementation, we'd copy the actual artifact content
		_, _ = artFile.Write([]byte(fmt.Sprintf("artifact: %s", art.Name)))
	}

	return zipWriter.Close()
}

func readExportBundle(path string) (*ArtifactExportBundle, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var bundle ArtifactExportBundle
	var manifestData []byte

	// Read all files
	files := make(map[string][]byte)
	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		files[f.Name] = data
		if f.Name == "manifest.json" {
			manifestData = data
		}
	}

	if manifestData == nil {
		return nil, fmt.Errorf("no manifest found in bundle")
	}

	if err := json.Unmarshal(manifestData, &bundle.Manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}

	// Reconstruct artifact refs from zip contents
	for name, data := range files {
		if name != "manifest.json" {
			bundle.Artifacts = append(bundle.Artifacts, ArtifactFileRef{
				Name:        name,
				ContentHash: determinism.Hash(string(data)),
				Size:        int64(len(data)),
			})
		}
	}

	return &bundle, nil
}
