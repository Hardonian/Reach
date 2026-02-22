// Package reporting includes bundle export and verification.
// Bundles are shareable, reproducible proof packages.
package reporting

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Bundle represents a shareable proof package.
type Bundle struct {
	Manifest   BundleManifest `json:"manifest"`
	EventLog   []map[string]any `json:"event_log"`
	Report     *Report        `json:"report,omitempty"`
	Artifacts  []ArtifactRef  `json:"artifacts,omitempty"`
}

// BundleManifest contains bundle metadata.
type BundleManifest struct {
	SpecVersion    string `json:"spec_version"`
	BundleID       string `json:"bundle_id"`
	RunID          string `json:"run_id"`
	RunFingerprint string `json:"run_fingerprint"`
	CreatedAt      string `json:"created_at"`
	TrustScore     float64 `json:"trust_score"`
	Status         string `json:"status"`
	Signature      string `json:"signature,omitempty"`
	Checksum       string `json:"checksum"`
}

// ArtifactRef references an artifact in the bundle.
type ArtifactRef struct {
	Name     string `json:"name"`
	Hash     string `json:"hash"`
	Size     int64  `json:"size"`
	Optional bool   `json:"optional,omitempty"`
}

// BundleExporter creates shareable bundles.
type BundleExporter struct {
	dataRoot string
}

// NewBundleExporter creates a bundle exporter.
func NewBundleExporter(dataRoot string) *BundleExporter {
	return &BundleExporter{dataRoot: dataRoot}
}

// Export creates a bundle from a run.
func (e *BundleExporter) Export(runID string, outputPath string) (*Bundle, error) {
	// Load run record
	record, err := e.loadRunRecord(runID)
	if err != nil {
		return nil, fmt.Errorf("failed to load run: %w", err)
	}

	// Generate report
	gen := NewGenerator(e.dataRoot)
	report, err := gen.Generate(runID, FormatJSON)
	if err != nil {
		// Continue without report if generation fails
		report = &Report{RunID: runID}
	}

	// Build bundle
	bundle := &Bundle{
		Manifest: BundleManifest{
			SpecVersion:    "1.0",
			BundleID:       generateBundleID(runID),
			RunID:          runID,
			RunFingerprint: getString(record, "fingerprint"),
			CreatedAt:      getString(record, "created_at"),
			TrustScore:     report.TrustScore,
			Status:         report.Status,
		},
		EventLog:  getEventLog(record),
		Report:    report,
		Artifacts: extractArtifacts(record),
	}

	// Calculate checksum
	bundle.Manifest.Checksum = calculateBundleChecksum(bundle)

	// Write to file
	if outputPath == "" {
		outputPath = filepath.Join(e.dataRoot, "bundles", runID+".bundle.json")
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return nil, err
	}

	data, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(outputPath, data, 0o644); err != nil {
		return nil, err
	}

	return bundle, nil
}

// Verify verifies a bundle's integrity.
func (e *BundleExporter) Verify(bundlePath string) (*VerificationResult, error) {
	// Read bundle
	data, err := os.ReadFile(bundlePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read bundle: %w", err)
	}

	var bundle Bundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse bundle: %w", err)
	}

	result := &VerificationResult{
		BundleID:       bundle.Manifest.BundleID,
		RunID:          bundle.Manifest.RunID,
		StoredChecksum: bundle.Manifest.Checksum,
	}

	// Verify checksum
	recomputed := calculateBundleChecksum(&bundle)
	result.RecomputedChecksum = recomputed
	result.ChecksumValid = recomputed == bundle.Manifest.Checksum

	// Verify fingerprint
	if len(bundle.EventLog) > 0 {
		eventHash := stableHash(map[string]any{
			"event_log": bundle.EventLog,
			"run_id":    bundle.Manifest.RunID,
		})
		result.FingerprintValid = eventHash == bundle.Manifest.RunFingerprint
		result.RecomputedFingerprint = eventHash
	}

	// Overall validity
	result.Valid = result.ChecksumValid && result.FingerprintValid

	return result, nil
}

// VerificationResult contains bundle verification results.
type VerificationResult struct {
	BundleID             string `json:"bundle_id"`
	RunID                string `json:"run_id"`
	Valid                bool   `json:"valid"`
	ChecksumValid        bool   `json:"checksum_valid"`
	FingerprintValid     bool   `json:"fingerprint_valid"`
	StoredChecksum       string `json:"stored_checksum"`
	RecomputedChecksum   string `json:"recomputed_checksum"`
	RecomputedFingerprint string `json:"recomputed_fingerprint,omitempty"`
}

// loadRunRecord loads a run record from storage.
func (e *BundleExporter) loadRunRecord(runID string) (map[string]any, error) {
	path := filepath.Join(e.dataRoot, "runs", runID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var record map[string]any
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, err
	}

	return record, nil
}

// Helper functions

func generateBundleID(runID string) string {
	hash := sha256.Sum256([]byte("bundle:" + runID))
	return fmt.Sprintf("%x", hash)[:16]
}

func calculateBundleChecksum(bundle *Bundle) string {
	// Create a deterministic representation for hashing
	data := map[string]any{
		"spec_version":    bundle.Manifest.SpecVersion,
		"bundle_id":       bundle.Manifest.BundleID,
		"run_id":          bundle.Manifest.RunID,
		"run_fingerprint": bundle.Manifest.RunFingerprint,
		"event_log":       bundle.EventLog,
	}
	return stableHash(data)
}

func stableHash(data map[string]any) string {
	// Sort keys and create deterministic JSON
	jsonData, _ := json.Marshal(sortKeys(data))
	hash := sha256.Sum256(jsonData)
	return fmt.Sprintf("%x", hash)
}

func sortKeys(data map[string]any) map[string]any {
	if data == nil {
		return nil
	}
	
	result := make(map[string]any)
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	
	for _, k := range keys {
		result[k] = data[k]
	}
	return result
}

func getEventLog(record map[string]any) []map[string]any {
	if raw, ok := record["event_log"].([]any); ok {
		log := make([]map[string]any, 0, len(raw))
		for _, e := range raw {
			if em, ok := e.(map[string]any); ok {
				log = append(log, em)
			}
		}
		return log
	}
	return nil
}

func extractArtifacts(record map[string]any) []ArtifactRef {
	artifacts := make([]ArtifactRef, 0)
	if raw, ok := record["artifacts"].([]any); ok {
		for _, a := range raw {
			if am, ok := a.(map[string]any); ok {
				artifacts = append(artifacts, ArtifactRef{
					Name: getString(am, "name"),
					Hash: getString(am, "hash"),
					Size: getInt64(am, "size"),
				})
			}
		}
	}
	return artifacts
}

func getInt64(m map[string]any, key string) int64 {
	if v, ok := m[key].(float64); ok {
		return int64(v)
	}
	return 0
}

// ExportToWriter writes a bundle to a writer.
func (e *BundleExporter) ExportToWriter(runID string, w io.Writer) error {
	bundle, err := e.Export(runID, "")
	if err != nil {
		return err
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(bundle)
}

// VerifyFromReader verifies a bundle from a reader.
func (e *BundleExporter) VerifyFromReader(r io.Reader) (*VerificationResult, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	var bundle Bundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, err
	}

	result := &VerificationResult{
		BundleID:       bundle.Manifest.BundleID,
		RunID:          bundle.Manifest.RunID,
		StoredChecksum: bundle.Manifest.Checksum,
	}

	recomputed := calculateBundleChecksum(&bundle)
	result.RecomputedChecksum = recomputed
	result.ChecksumValid = recomputed == bundle.Manifest.Checksum
	result.Valid = result.ChecksumValid

	return result, nil
}

// ListBundles lists all available bundles.
func (e *BundleExporter) ListBundles() ([]BundleManifest, error) {
	bundlesDir := filepath.Join(e.dataRoot, "bundles")
	entries, err := os.ReadDir(bundlesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []BundleManifest{}, nil
		}
		return nil, err
	}

	var manifests []BundleManifest
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".bundle.json") {
			path := filepath.Join(bundlesDir, entry.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			var bundle Bundle
			if err := json.Unmarshal(data, &bundle); err != nil {
				continue
			}

			manifests = append(manifests, bundle.Manifest)
		}
	}

	// Sort by bundle ID for deterministic output
	sort.Slice(manifests, func(i, j int) bool {
		return manifests[i].BundleID < manifests[j].BundleID
	})

	return manifests, nil
}
