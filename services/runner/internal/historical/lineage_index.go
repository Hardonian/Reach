// Package historical provides historical intelligence capabilities for Reach runs.
// It enables analysis over time, drift detection, baseline management, and trend metrics.
package historical

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// ErrNotFound is returned when a record is not found.
var ErrNotFound = errors.New("not found")

// ============================================================================
// LINEAGE INDEX - Core Data Structures
// ============================================================================

// EvidenceIndexRecord represents an indexed evidence entry for fast lookup.
type EvidenceIndexRecord struct {
	ID           int64     `json:"id"`
	RunID        string    `json:"run_id"`
	StepIndex    int       `json:"step_index"`
	StepKey      string    `json:"step_key"`
	EventType    string    `json:"event_type"`
	ArtifactHash string    `json:"artifact_hash"`
	PluginName   string    `json:"plugin_name,omitempty"`
	ProofHash    string    `json:"proof_hash"`
	Timestamp    time.Time `json:"timestamp"`
}

// ArtifactHashLookup enables reverse lookup from artifact hash to runs.
type ArtifactHashLookup struct {
	ArtifactHash string    `json:"artifact_hash"`
	RunID        string    `json:"run_id"`
	StepIndex    int       `json:"step_index"`
	ArtifactType string    `json:"artifact_type"`
	Timestamp    time.Time `json:"timestamp"`
}

// StepKeyFrequency tracks historical frequency of step keys.
type StepKeyFrequency struct {
	StepKey       string    `json:"step_key"`
	Count         int       `json:"count"`
	LastSeen      time.Time `json:"last_seen"`
	AvgProofVariance float64 `json:"avg_proof_variance"`
	SuccessRate   float64   `json:"success_rate"`
}

// SearchResult represents a search result from the lineage index.
type SearchResult struct {
	RunID        string                 `json:"run_id"`
	StepIndex    int                    `json:"step_index"`
	StepKey      string                 `json:"step_key"`
	EventType    string                 `json:"event_type"`
	ArtifactHash string                 `json:"artifact_hash"`
	PluginName   string                 `json:"plugin_name,omitempty"`
	SimilarityScore float64              `json:"similarity_score,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// SimilarRun represents a run similar to a reference run.
type SimilarRun struct {
	RunID           string    `json:"run_id"`
	SimilarityScore float64   `json:"similarity_score"`
	CommonSteps     int       `json:"common_steps"`
	CommonArtifacts int       `json:"common_artifacts"`
	DivergencePoint int       `json:"divergence_point"`
	Timestamp       time.Time `json:"timestamp"`
}

// ============================================================================
// LINEAGE INDEX - Storage Layer
// ============================================================================

// LineageIndex provides indexed access to historical run evidence.
type LineageIndex struct {
	db  *sql.DB
	mu  sync.RWMutex
	dir string
}

// NewLineageIndex creates a new lineage index with SQLite storage.
func NewLineageIndex(dataDir string) (*LineageIndex, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "lineage_index.db")
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	idx := &LineageIndex{db: db, dir: dataDir}
	if err := idx.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return idx, nil
}

// migrate creates the necessary tables for the lineage index.
func (idx *LineageIndex) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS evidence_index (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			run_id TEXT NOT NULL,
			step_index INTEGER NOT NULL,
			step_key TEXT NOT NULL,
			event_type TEXT NOT NULL,
			artifact_hash TEXT,
			plugin_name TEXT,
			proof_hash TEXT,
			timestamp TIMESTAMP NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_evidence_run_id ON evidence_index(run_id)`,
		`CREATE INDEX IF NOT EXISTS idx_evidence_step_key ON evidence_index(step_key)`,
		`CREATE INDEX IF NOT EXISTS idx_evidence_artifact_hash ON evidence_index(artifact_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_evidence_plugin ON evidence_index(plugin_name)`,
		`CREATE TABLE IF NOT EXISTS artifact_lookup (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			artifact_hash TEXT NOT NULL,
			run_id TEXT NOT NULL,
			step_index INTEGER NOT NULL,
			artifact_type TEXT,
			timestamp TIMESTAMP NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_artifact_hash ON artifact_lookup(artifact_hash)`,
		`CREATE TABLE IF NOT EXISTS step_frequency (
			step_key TEXT PRIMARY KEY,
			count INTEGER NOT NULL DEFAULT 0,
			last_seen TIMESTAMP,
			avg_proof_variance REAL DEFAULT 0,
			success_rate REAL DEFAULT 1.0
		)`,
		`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)`,
	}
	for _, q := range queries {
		if _, err := idx.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection.
func (idx *LineageIndex) Close() error {
	return idx.db.Close()
}

// ============================================================================
// INDEXING OPERATIONS
// ============================================================================

// IndexRun indexes all evidence from a run for fast lookup.
func (idx *LineageIndex) IndexRun(ctx context.Context, runID string, events []map[string]interface{}) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC()

	for i, event := range events {
		stepKey := extractStepKey(event)
		eventType := getString(event, "type")
		artifactHash := extractArtifactHash(event)
		pluginName := extractPluginName(event)
		proofHash := computeStepProofHash(runID, i, event)

		// Insert into evidence index
		_, err := tx.ExecContext(ctx, `
			INSERT INTO evidence_index (run_id, step_index, step_key, event_type, artifact_hash, plugin_name, proof_hash, timestamp)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, runID, i, stepKey, eventType, artifactHash, pluginName, proofHash, now)
		if err != nil {
			return err
		}

		// Insert into artifact lookup if hash present
		if artifactHash != "" {
			_, err = tx.ExecContext(ctx, `
				INSERT INTO artifact_lookup (artifact_hash, run_id, step_index, artifact_type, timestamp)
				VALUES (?, ?, ?, ?, ?)
			`, artifactHash, runID, i, eventType, now)
			if err != nil {
				return err
			}
		}

		// Update step frequency
		_, err = tx.ExecContext(ctx, `
			INSERT INTO step_frequency (step_key, count, last_seen)
			VALUES (?, 1, ?)
			ON CONFLICT(step_key) DO UPDATE SET 
				count = count + 1,
				last_seen = excluded.last_seen
		`, stepKey, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ============================================================================
// SEARCH OPERATIONS
// ============================================================================

// SearchByHash finds all runs that used a specific artifact hash.
func (idx *LineageIndex) SearchByHash(ctx context.Context, hash string) ([]SearchResult, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	rows, err := idx.db.QueryContext(ctx, `
		SELECT e.run_id, e.step_index, e.step_key, e.event_type, e.artifact_hash, e.plugin_name
		FROM evidence_index e
		WHERE e.artifact_hash = ?
		ORDER BY e.timestamp DESC
	`, hash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		var pluginName sql.NullString
		if err := rows.Scan(&r.RunID, &r.StepIndex, &r.StepKey, &r.EventType, &r.ArtifactHash, &pluginName); err != nil {
			return nil, err
		}
		r.PluginName = pluginName.String
		results = append(results, r)
	}
	return results, rows.Err()
}

// SearchByStep finds all runs that contain a specific step key.
func (idx *LineageIndex) SearchByStep(ctx context.Context, stepKey string, limit int) ([]SearchResult, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	rows, err := idx.db.QueryContext(ctx, `
		SELECT run_id, step_index, step_key, event_type, artifact_hash, plugin_name
		FROM evidence_index
		WHERE step_key = ?
		ORDER BY timestamp DESC
		LIMIT ?
	`, stepKey, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		var pluginName sql.NullString
		if err := rows.Scan(&r.RunID, &r.StepIndex, &r.StepKey, &r.EventType, &r.ArtifactHash, &pluginName); err != nil {
			return nil, err
		}
		r.PluginName = pluginName.String
		results = append(results, r)
	}
	return results, rows.Err()
}

// SearchByPlugin finds all runs that used a specific plugin.
func (idx *LineageIndex) SearchByPlugin(ctx context.Context, pluginName string, limit int) ([]SearchResult, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	rows, err := idx.db.QueryContext(ctx, `
		SELECT run_id, step_index, step_key, event_type, artifact_hash, plugin_name
		FROM evidence_index
		WHERE plugin_name = ?
		ORDER BY timestamp DESC
		LIMIT ?
	`, pluginName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		var pluginName sql.NullString
		if err := rows.Scan(&r.RunID, &r.StepIndex, &r.StepKey, &r.EventType, &r.ArtifactHash, &pluginName); err != nil {
			return nil, err
		}
		r.PluginName = pluginName.String
		results = append(results, r)
	}
	return results, rows.Err()
}

// SearchSimilar finds runs similar to the given reference run.
func (idx *LineageIndex) SearchSimilar(ctx context.Context, runID string, limit int) ([]SimilarRun, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}

	// Get reference run's step keys and artifact hashes
	refSteps := make(map[string]bool)
	refArtifacts := make(map[string]bool)
	
	rows, err := idx.db.QueryContext(ctx, `
		SELECT step_key, artifact_hash FROM evidence_index WHERE run_id = ?
	`, runID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var stepKey, artifactHash string
		if err := rows.Scan(&stepKey, &artifactHash); err != nil {
			rows.Close()
			return nil, err
		}
		refSteps[stepKey] = true
		if artifactHash != "" {
			refArtifacts[artifactHash] = true
		}
	}
	rows.Close()

	// Find candidate runs with overlapping steps
	candidateRows, err := idx.db.QueryContext(ctx, `
		SELECT DISTINCT run_id FROM evidence_index 
		WHERE run_id != ? AND step_key IN (
			SELECT step_key FROM evidence_index WHERE run_id = ?
		)
	`, runID, runID)
	if err != nil {
		return nil, err
	}
	defer candidateRows.Close()

	var candidates []string
	for candidateRows.Next() {
		var candidate string
		if err := candidateRows.Scan(&candidate); err != nil {
			return nil, err
		}
		candidates = append(candidates, candidate)
	}

	// Score each candidate
	var similarRuns []SimilarRun
	for _, candidate := range candidates {
		// Get candidate's steps and artifacts
		candSteps := make(map[string]bool)
		candArtifacts := make(map[string]bool)
		var candTimestamp time.Time
		
		rows, err := idx.db.QueryContext(ctx, `
			SELECT step_key, artifact_hash, timestamp FROM evidence_index WHERE run_id = ?
		`, candidate)
		if err != nil {
			continue
		}
		stepIdx := 0
		for rows.Next() {
			var stepKey, artifactHash string
			var ts time.Time
			if err := rows.Scan(&stepKey, &artifactHash, &ts); err != nil {
				rows.Close()
				continue
			}
			candSteps[stepKey] = true
			if artifactHash != "" {
				candArtifacts[artifactHash] = true
			}
			if stepIdx == 0 {
				candTimestamp = ts
			}
			stepIdx++
		}
		rows.Close()

		// Calculate similarity
		commonSteps := 0
		for step := range refSteps {
			if candSteps[step] {
				commonSteps++
			}
		}
		commonArtifacts := 0
		for artifact := range refArtifacts {
			if candArtifacts[artifact] {
				commonArtifacts++
			}
		}

		// Jaccard similarity
		unionSteps := len(refSteps) + len(candSteps) - commonSteps
		unionArtifacts := len(refArtifacts) + len(candArtifacts) - commonArtifacts
		
		stepSimilarity := 0.0
		if unionSteps > 0 {
			stepSimilarity = float64(commonSteps) / float64(unionSteps)
		}
		artifactSimilarity := 0.0
		if unionArtifacts > 0 {
			artifactSimilarity = float64(commonArtifacts) / float64(unionArtifacts)
		}
		
		// Combined score (weighted)
		similarityScore := 0.6*stepSimilarity + 0.4*artifactSimilarity

		if similarityScore > 0.1 { // Threshold
			similarRuns = append(similarRuns, SimilarRun{
				RunID:           candidate,
				SimilarityScore: similarityScore,
				CommonSteps:     commonSteps,
				CommonArtifacts: commonArtifacts,
				DivergencePoint: findDivergencePoint(refSteps, candSteps),
				Timestamp:       candTimestamp,
			})
		}
	}

	// Sort by similarity score descending
	sort.Slice(similarRuns, func(i, j int) bool {
		return similarRuns[i].SimilarityScore > similarRuns[j].SimilarityScore
	})

	if len(similarRuns) > limit {
		similarRuns = similarRuns[:limit]
	}

	return similarRuns, nil
}

// GetStepFrequency returns the historical frequency for a step key.
func (idx *LineageIndex) GetStepFrequency(ctx context.Context, stepKey string) (StepKeyFrequency, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	var freq StepKeyFrequency
	err := idx.db.QueryRowContext(ctx, `
		SELECT step_key, count, last_seen, avg_proof_variance, success_rate
		FROM step_frequency WHERE step_key = ?
	`, stepKey).Scan(&freq.StepKey, &freq.Count, &freq.LastSeen, &freq.AvgProofVariance, &freq.SuccessRate)
	if err == sql.ErrNoRows {
		return freq, ErrNotFound
	}
	return freq, err
}

// ListTopStepKeys returns the most frequently used step keys.
func (idx *LineageIndex) ListTopStepKeys(ctx context.Context, limit int) ([]StepKeyFrequency, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	}

	rows, err := idx.db.QueryContext(ctx, `
		SELECT step_key, count, last_seen, avg_proof_variance, success_rate
		FROM step_frequency
		ORDER BY count DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []StepKeyFrequency
	for rows.Next() {
		var f StepKeyFrequency
		if err := rows.Scan(&f.StepKey, &f.Count, &f.LastSeen, &f.AvgProofVariance, &f.SuccessRate); err != nil {
			return nil, err
		}
		results = append(results, f)
	}
	return results, rows.Err()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func extractStepKey(event map[string]interface{}) string {
	// Try common step key patterns
	if tool := getString(event, "tool"); tool != "" {
		return "tool:" + tool
	}
	if stepType := getString(event, "type"); stepType != "" {
		if name := getString(event, "name"); name != "" {
			return stepType + ":" + name
		}
		return stepType
	}
	if name := getString(event, "step_name"); name != "" {
		return name
	}
	return "unknown"
}

func extractArtifactHash(event map[string]interface{}) string {
	// Try common artifact hash patterns
	if hash := getString(event, "artifact_hash"); hash != "" {
		return hash
	}
	if hash := getString(event, "hash"); hash != "" {
		return hash
	}
	if result := getMap(event, "result"); result != nil {
		if hash := getString(result, "hash"); hash != "" {
			return hash
		}
	}
	if artifact := getMap(event, "artifact"); artifact != nil {
		if hash := getString(artifact, "hash"); hash != "" {
			return hash
		}
	}
	return ""
}

func extractPluginName(event map[string]interface{}) string {
	if plugin := getString(event, "plugin"); plugin != "" {
		return plugin
	}
	if plugin := getString(event, "plugin_name"); plugin != "" {
		return plugin
	}
	if tool := getString(event, "tool"); tool != "" {
		// Extract plugin from tool name (e.g., "plugin.tool" -> "plugin")
		if idx := strings.Index(tool, "."); idx > 0 {
			return tool[:idx]
		}
	}
	return ""
}

func computeStepProofHash(runID string, stepIndex int, event map[string]interface{}) string {
	data := map[string]interface{}{
		"run_id":     runID,
		"step_index": stepIndex,
		"event":      event,
	}
	b, _ := json.Marshal(data)
	hash := sha256.Sum256(b)
	return fmt.Sprintf("%x", hash)[:16]
}

func findDivergencePoint(refSteps, candSteps map[string]bool) int {
	// Simple heuristic: count steps that are in reference but not in candidate
	divergence := 0
	for step := range refSteps {
		if !candSteps[step] {
			divergence++
		}
	}
	return divergence
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if v, ok := m[key]; ok {
		if m2, ok := v.(map[string]interface{}); ok {
			return m2
		}
	}
	return nil
}
