// Package historical provides historical intelligence capabilities for Reach runs.
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
)

// ============================================================================
// BASELINE FREEZE - Core Data Structures
// ============================================================================

// Baseline represents a frozen baseline for comparison.
type Baseline struct {
	ID             string                 `json:"id"`
	PipelineID     string                 `json:"pipeline_id"`
	RunID          string                 `json:"run_id"`
	FrozenAt       time.Time              `json:"frozen_at"`
	FrozenBy       string                 `json:"frozen_by,omitempty"`
	Immutable      bool                   `json:"immutable"`
	Metrics        BaselineMetrics        `json:"metrics"`
	StepProofs     map[string]string      `json:"step_proofs"`     // step_key -> proof_hash
	ArtifactHashes map[string]string      `json:"artifact_hashes"` // artifact_name -> hash
	EventLogHash   string                 `json:"event_log_hash"`
	Fingerprint    string                 `json:"fingerprint"`
	Signature      string                 `json:"signature,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// BaselineMetrics captures the metrics at baseline freeze time.
type BaselineMetrics struct {
	ReproducibilityScore float64 `json:"reproducibility_score"`
	TrustScore           float64 `json:"trust_score"`
	ChaosSensitivity     float64 `json:"chaos_sensitivity"`
	StepCount            int     `json:"step_count"`
	ArtifactCount        int     `json:"artifact_count"`
}

// BaselineComparison represents the result of comparing a run to a baseline.
type BaselineComparison struct {
	BaselineID       string             `json:"baseline_id"`
	BaselineRunID    string             `json:"baseline_run_id"`
	ComparisonRunID  string             `json:"comparison_run_id"`
	ComparedAt       time.Time          `json:"compared_at"`
	DeltaRisk        DeltaRisk          `json:"delta_risk"`
	StepDeltas       []StepDelta        `json:"step_deltas"`
	ArtifactDeltas   []ArtifactDelta    `json:"artifact_deltas"`
	MetricDeltas     MetricDeltas       `json:"metric_deltas"`
	Recommendation   string             `json:"recommendation"`
	Approved         bool               `json:"approved"`
}

// DeltaRisk represents the overall risk assessment of changes.
type DeltaRisk struct {
	OverallRiskScore float64 `json:"overall_risk_score"` // 0-100
	RiskLevel        string  `json:"risk_level"`        // "low", "medium", "high", "critical"
	ChangeIntensity  float64 `json:"change_intensity"`  // 0-1
	BreakingChanges  int     `json:"breaking_changes"`
	NewRisks         []string `json:"new_risks"`
}

// StepDelta represents a change in a step.
type StepDelta struct {
	StepKey       string    `json:"step_key"`
	StepIndex     int       `json:"step_index"`
	DeltaType     string    `json:"delta_type"` // "added", "removed", "modified", "unchanged"
	BaselineProof string    `json:"baseline_proof,omitempty"`
	CurrentProof  string    `json:"current_proof,omitempty"`
	RiskImpact    float64   `json:"risk_impact"` // 0-1
	Details       string    `json:"details,omitempty"`
}

// ArtifactDelta represents a change in an artifact.
type ArtifactDelta struct {
	ArtifactName  string `json:"artifact_name"`
	DeltaType     string `json:"delta_type"` // "added", "removed", "modified", "unchanged"
	BaselineHash  string `json:"baseline_hash,omitempty"`
	CurrentHash   string `json:"current_hash,omitempty"`
	RiskImpact    float64 `json:"risk_impact"`
}

// MetricDeltas represents changes in metrics.
type MetricDeltas struct {
	ReproducibilityDelta float64 `json:"reproducibility_delta"`
	TrustScoreDelta      float64 `json:"trust_score_delta"`
	ChaosSensitivityDelta float64 `json:"chaos_sensitivity_delta"`
	StepCountDelta       int     `json:"step_count_delta"`
}

// ErrBaselineImmutable is returned when attempting to modify a frozen baseline.
var ErrBaselineImmutable = errors.New("baseline is immutable and cannot be modified")

// ErrBaselineNotFound is returned when a baseline is not found.
var ErrBaselineNotFound = errors.New("baseline not found")

// ============================================================================
// BASELINE MANAGER - Storage Layer
// ============================================================================

// BaselineManager manages frozen baselines.
type BaselineManager struct {
	db      *sql.DB
	mu      sync.RWMutex
	dataDir string
	detector *DriftDetector
}

// NewBaselineManager creates a new baseline manager.
func NewBaselineManager(dataDir string, detector *DriftDetector) (*BaselineManager, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "baselines.db")
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	mgr := &BaselineManager{db: db, dataDir: dataDir, detector: detector}
	if err := mgr.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return mgr, nil
}

// migrate creates the necessary tables for baselines.
func (m *BaselineManager) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS baselines (
			id TEXT PRIMARY KEY,
			pipeline_id TEXT NOT NULL,
			run_id TEXT NOT NULL,
			frozen_at TIMESTAMP NOT NULL,
			frozen_by TEXT,
			immutable INTEGER NOT NULL DEFAULT 1,
			metrics_json TEXT NOT NULL,
			step_proofs_json TEXT NOT NULL,
			artifact_hashes_json TEXT NOT NULL,
			event_log_hash TEXT,
			fingerprint TEXT,
			signature TEXT,
			metadata_json TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_baselines_pipeline ON baselines(pipeline_id)`,
		`CREATE INDEX IF NOT EXISTS idx_baselines_run ON baselines(run_id)`,
		`CREATE TABLE IF NOT EXISTS baseline_comparisons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			baseline_id TEXT NOT NULL,
			comparison_run_id TEXT NOT NULL,
			compared_at TIMESTAMP NOT NULL,
			result_json TEXT NOT NULL,
			FOREIGN KEY (baseline_id) REFERENCES baselines(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_comparisons_baseline ON baseline_comparisons(baseline_id)`,
	}
	for _, q := range queries {
		if _, err := m.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection.
func (m *BaselineManager) Close() error {
	return m.db.Close()
}

// ============================================================================
// BASELINE OPERATIONS
// ============================================================================

// FreezeBaseline creates a new frozen baseline from a run.
func (m *BaselineManager) FreezeBaseline(ctx context.Context, pipelineID, runID string, events []map[string]interface{}, frozenBy string) (*Baseline, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if baseline already exists for this pipeline
	var existingID string
	err := m.db.QueryRowContext(ctx, 
		"SELECT id FROM baselines WHERE pipeline_id = ?", pipelineID).Scan(&existingID)
	if err == nil {
		// Check if it's immutable
		var immutable bool
		err = m.db.QueryRowContext(ctx, 
			"SELECT immutable FROM baselines WHERE id = ?", existingID).Scan(&immutable)
		if err == nil && immutable {
			return nil, fmt.Errorf("%w: baseline %s exists and is immutable", ErrBaselineImmutable, existingID)
		}
	}

	now := time.Now().UTC()
	id := generateBaselineID(pipelineID, runID, now)

	// Extract step proofs
	stepProofs := make(map[string]string)
	for i, event := range events {
		stepKey := extractStepKey(event)
		proofHash := computeStepProofHash(runID, i, event)
		stepProofs[stepKey] = proofHash
	}

	// Extract artifact hashes
	artifactHashes := make(map[string]string)
	for _, event := range events {
		if artifactName := getString(event, "artifact_name"); artifactName != "" {
			if hash := extractArtifactHash(event); hash != "" {
				artifactHashes[artifactName] = hash
			}
		}
	}

	// Compute event log hash
	eventLogHash := computeEventLogHash(events)

	// Compute fingerprint
	fingerprint := computeBaselineFingerprint(id, stepProofs, artifactHashes)

	// Create metrics (would normally come from detector)
	metrics := BaselineMetrics{
		ReproducibilityScore: 0.95,
		TrustScore:           0.92,
		ChaosSensitivity:     0.05,
		StepCount:            len(events),
		ArtifactCount:        len(artifactHashes),
	}

	baseline := &Baseline{
		ID:             id,
		PipelineID:     pipelineID,
		RunID:          runID,
		FrozenAt:       now,
		FrozenBy:       frozenBy,
		Immutable:       true,
		Metrics:        metrics,
		StepProofs:     stepProofs,
		ArtifactHashes: artifactHashes,
		EventLogHash:   eventLogHash,
		Fingerprint:    fingerprint,
		Metadata:       make(map[string]interface{}),
	}

	// Store in database
	metricsJSON, _ := json.Marshal(metrics)
	stepProofsJSON, _ := json.Marshal(stepProofs)
	artifactHashesJSON, _ := json.Marshal(artifactHashes)
	metadataJSON, _ := json.Marshal(baseline.Metadata)

	_, err = m.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO baselines 
		(id, pipeline_id, run_id, frozen_at, frozen_by, immutable, metrics_json, step_proofs_json, 
		 artifact_hashes_json, event_log_hash, fingerprint, metadata_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, pipelineID, runID, now, frozenBy, true, string(metricsJSON), string(stepProofsJSON),
		string(artifactHashesJSON), eventLogHash, fingerprint, string(metadataJSON))
	if err != nil {
		return nil, err
	}

	return baseline, nil
}

// GetBaseline retrieves a baseline by ID.
func (m *BaselineManager) GetBaseline(ctx context.Context, id string) (*Baseline, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var baseline Baseline
	var metricsJSON, stepProofsJSON, artifactHashesJSON, metadataJSON string
	var frozenBy, signature sql.NullString

	err := m.db.QueryRowContext(ctx, `
		SELECT id, pipeline_id, run_id, frozen_at, frozen_by, immutable, metrics_json, 
		       step_proofs_json, artifact_hashes_json, event_log_hash, fingerprint, signature, metadata_json
		FROM baselines WHERE id = ?
	`, id).Scan(&baseline.ID, &baseline.PipelineID, &baseline.RunID, &baseline.FrozenAt, 
		&frozenBy, &baseline.Immutable, &metricsJSON, &stepProofsJSON, &artifactHashesJSON,
		&baseline.EventLogHash, &baseline.Fingerprint, &signature, &metadataJSON)
	if err == sql.ErrNoRows {
		return nil, ErrBaselineNotFound
	}
	if err != nil {
		return nil, err
	}

	baseline.FrozenBy = frozenBy.String
	baseline.Signature = signature.String
	json.Unmarshal([]byte(metricsJSON), &baseline.Metrics)
	json.Unmarshal([]byte(stepProofsJSON), &baseline.StepProofs)
	json.Unmarshal([]byte(artifactHashesJSON), &baseline.ArtifactHashes)
	json.Unmarshal([]byte(metadataJSON), &baseline.Metadata)

	return &baseline, nil
}

// GetBaselineByPipeline retrieves the baseline for a pipeline.
func (m *BaselineManager) GetBaselineByPipeline(ctx context.Context, pipelineID string) (*Baseline, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var id string
	err := m.db.QueryRowContext(ctx, 
		"SELECT id FROM baselines WHERE pipeline_id = ? ORDER BY frozen_at DESC LIMIT 1", 
		pipelineID).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, ErrBaselineNotFound
	}
	if err != nil {
		return nil, err
	}

	return m.GetBaseline(ctx, id)
}

// ListBaselines lists all baselines.
func (m *BaselineManager) ListBaselines(ctx context.Context, limit int) ([]Baseline, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	rows, err := m.db.QueryContext(ctx, `
		SELECT id, pipeline_id, run_id, frozen_at, frozen_by, immutable, fingerprint
		FROM baselines ORDER BY frozen_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var baselines []Baseline
	for rows.Next() {
		var b Baseline
		var frozenBy sql.NullString
		if err := rows.Scan(&b.ID, &b.PipelineID, &b.RunID, &b.FrozenAt, &frozenBy, &b.Immutable, &b.Fingerprint); err != nil {
			return nil, err
		}
		b.FrozenBy = frozenBy.String
		baselines = append(baselines, b)
	}
	return baselines, rows.Err()
}

// DeleteBaseline deletes a baseline (only if not immutable).
func (m *BaselineManager) DeleteBaseline(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var immutable bool
	err := m.db.QueryRowContext(ctx, "SELECT immutable FROM baselines WHERE id = ?", id).Scan(&immutable)
	if err == sql.ErrNoRows {
		return ErrBaselineNotFound
	}
	if err != nil {
		return err
	}

	if immutable {
		return ErrBaselineImmutable
	}

	_, err = m.db.ExecContext(ctx, "DELETE FROM baselines WHERE id = ?", id)
	return err
}

// ============================================================================
// COMPARISON OPERATIONS
// ============================================================================

// CompareToBaseline compares a run to a baseline.
func (m *BaselineManager) CompareToBaseline(ctx context.Context, baselineID, comparisonRunID string, events []map[string]interface{}) (*BaselineComparison, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Get baseline
	baseline, err := m.GetBaseline(ctx, baselineID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	comparison := &BaselineComparison{
		BaselineID:      baselineID,
		BaselineRunID:   baseline.RunID,
		ComparisonRunID: comparisonRunID,
		ComparedAt:      now,
	}

	// Compute step deltas
	comparison.StepDeltas = m.computeStepDeltas(baseline, events)

	// Compute artifact deltas
	comparison.ArtifactDeltas = m.computeArtifactDeltas(baseline, events)

	// Compute metric deltas
	comparison.MetricDeltas = m.computeMetricDeltas(baseline, events)

	// Compute delta risk
	comparison.DeltaRisk = m.computeDeltaRisk(comparison)

	// Generate recommendation
	comparison.Recommendation = m.generateRecommendation(comparison)

	// Determine approval
	comparison.Approved = comparison.DeltaRisk.OverallRiskScore < 50

	// Store comparison
	resultJSON, _ := json.Marshal(comparison)
	_, err = m.db.ExecContext(ctx, `
		INSERT INTO baseline_comparisons (baseline_id, comparison_run_id, compared_at, result_json)
		VALUES (?, ?, ?, ?)
	`, baselineID, comparisonRunID, now, string(resultJSON))
	if err != nil {
		return nil, err
	}

	return comparison, nil
}

// computeStepDeltas computes the step deltas between baseline and current run.
func (m *BaselineManager) computeStepDeltas(baseline *Baseline, events []map[string]interface{}) []StepDelta {
	var deltas []StepDelta

	// Current step proofs
	currentProofs := make(map[string]string)
	currentIndices := make(map[string]int)
	for i, event := range events {
		stepKey := extractStepKey(event)
		proofHash := computeStepProofHash(baseline.RunID, i, event)
		currentProofs[stepKey] = proofHash
		currentIndices[stepKey] = i
	}

	// Check baseline steps
	for stepKey, baselineProof := range baseline.StepProofs {
		currentProof, exists := currentProofs[stepKey]
		if !exists {
			deltas = append(deltas, StepDelta{
				StepKey:       stepKey,
				DeltaType:     "removed",
				BaselineProof: baselineProof,
				RiskImpact:    0.8,
				Details:       "Step removed from current run",
			})
			continue
		}

		if currentProof != baselineProof {
			deltas = append(deltas, StepDelta{
				StepKey:       stepKey,
				StepIndex:     currentIndices[stepKey],
				DeltaType:     "modified",
				BaselineProof: baselineProof,
				CurrentProof:  currentProof,
				RiskImpact:    0.5,
				Details:       "Step proof hash changed",
			})
		} else {
			deltas = append(deltas, StepDelta{
				StepKey:       stepKey,
				StepIndex:     currentIndices[stepKey],
				DeltaType:     "unchanged",
				BaselineProof: baselineProof,
				CurrentProof:  currentProof,
				RiskImpact:    0.0,
			})
		}
	}

	// Check for new steps
	for stepKey, currentProof := range currentProofs {
		if _, exists := baseline.StepProofs[stepKey]; !exists {
			deltas = append(deltas, StepDelta{
				StepKey:      stepKey,
				StepIndex:    currentIndices[stepKey],
				DeltaType:    "added",
				CurrentProof: currentProof,
				RiskImpact:   0.3,
				Details:      "New step added to current run",
			})
		}
	}

	// Sort by step index
	sort.Slice(deltas, func(i, j int) bool {
		return deltas[i].StepIndex < deltas[j].StepIndex
	})

	return deltas
}

// computeArtifactDeltas computes the artifact deltas.
func (m *BaselineManager) computeArtifactDeltas(baseline *Baseline, events []map[string]interface{}) []ArtifactDelta {
	var deltas []ArtifactDelta

	// Current artifact hashes
	currentHashes := make(map[string]string)
	for _, event := range events {
		if artifactName := getString(event, "artifact_name"); artifactName != "" {
			if hash := extractArtifactHash(event); hash != "" {
				currentHashes[artifactName] = hash
			}
		}
	}

	// Check baseline artifacts
	for name, baselineHash := range baseline.ArtifactHashes {
		currentHash, exists := currentHashes[name]
		if !exists {
			deltas = append(deltas, ArtifactDelta{
				ArtifactName: name,
				DeltaType:    "removed",
				BaselineHash: baselineHash,
				RiskImpact:   0.7,
			})
			continue
		}

		if currentHash != baselineHash {
			deltas = append(deltas, ArtifactDelta{
				ArtifactName: name,
				DeltaType:    "modified",
				BaselineHash: baselineHash,
				CurrentHash:  currentHash,
				RiskImpact:   0.4,
			})
		} else {
			deltas = append(deltas, ArtifactDelta{
				ArtifactName: name,
				DeltaType:    "unchanged",
				BaselineHash: baselineHash,
				CurrentHash:  currentHash,
				RiskImpact:   0.0,
			})
		}
	}

	// Check for new artifacts
	for name, currentHash := range currentHashes {
		if _, exists := baseline.ArtifactHashes[name]; !exists {
			deltas = append(deltas, ArtifactDelta{
				ArtifactName: name,
				DeltaType:    "added",
				CurrentHash:  currentHash,
				RiskImpact:   0.2,
			})
		}
	}

	return deltas
}

// computeMetricDeltas computes the metric deltas.
func (m *BaselineManager) computeMetricDeltas(baseline *Baseline, events []map[string]interface{}) MetricDeltas {
	// Compute current metrics (simplified)
	currentStepCount := len(events)
	currentArtifactCount := 0
	for _, event := range events {
		if extractArtifactHash(event) != "" {
			currentArtifactCount++
		}
	}

	return MetricDeltas{
		ReproducibilityDelta:  0.0, // Would come from actual metrics
		TrustScoreDelta:       0.0,
		ChaosSensitivityDelta: 0.0,
		StepCountDelta:        currentStepCount - baseline.Metrics.StepCount,
	}
}

// computeDeltaRisk computes the overall delta risk.
func (m *BaselineManager) computeDeltaRisk(comparison *BaselineComparison) DeltaRisk {
	risk := DeltaRisk{
		NewRisks: []string{},
	}

	// Calculate change intensity
	totalSteps := len(comparison.StepDeltas)
	if totalSteps == 0 {
		totalSteps = 1
	}
	modifiedSteps := 0
	removedSteps := 0
	breakingChanges := 0

	for _, delta := range comparison.StepDeltas {
		if delta.DeltaType == "modified" {
			modifiedSteps++
		}
		if delta.DeltaType == "removed" {
			removedSteps++
			breakingChanges++
		}
		if delta.RiskImpact > 0.6 {
			breakingChanges++
		}
	}

	risk.ChangeIntensity = float64(modifiedSteps+removedSteps) / float64(totalSteps)
	risk.BreakingChanges = breakingChanges

	// Calculate overall risk score
	riskScore := 0.0
	riskScore += risk.ChangeIntensity * 40
	riskScore += float64(breakingChanges) * 15

	// Add artifact risk
	for _, delta := range comparison.ArtifactDeltas {
		if delta.DeltaType == "removed" {
			riskScore += 10
			risk.NewRisks = append(risk.NewRisks, 
				fmt.Sprintf("Artifact '%s' removed", delta.ArtifactName))
		}
		if delta.DeltaType == "modified" {
			riskScore += 5
		}
	}

	// Cap at 100
	risk.OverallRiskScore = min(riskScore, 100)

	// Determine risk level
	switch {
	case risk.OverallRiskScore >= 70:
		risk.RiskLevel = "critical"
	case risk.OverallRiskScore >= 50:
		risk.RiskLevel = "high"
	case risk.OverallRiskScore >= 25:
		risk.RiskLevel = "medium"
	default:
		risk.RiskLevel = "low"
	}

	return risk
}

// generateRecommendation generates a recommendation based on the comparison.
func (m *BaselineManager) generateRecommendation(comparison *BaselineComparison) string {
	switch comparison.DeltaRisk.RiskLevel {
	case "critical":
		return "DO NOT DEPLOY. Critical changes detected. Review all breaking changes before proceeding."
	case "high":
		return "CAUTION. High-risk changes detected. Manual review recommended before deployment."
	case "medium":
		return "MONITOR. Moderate changes detected. Review modified steps and artifacts."
	default:
		return "SAFE. Low-risk changes detected. Proceed with deployment."
	}
}

// GetComparisonHistory retrieves comparison history for a baseline.
func (m *BaselineManager) GetComparisonHistory(ctx context.Context, baselineID string, limit int) ([]BaselineComparison, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	}

	rows, err := m.db.QueryContext(ctx, `
		SELECT result_json FROM baseline_comparisons 
		WHERE baseline_id = ? ORDER BY compared_at DESC LIMIT ?
	`, baselineID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comparisons []BaselineComparison
	for rows.Next() {
		var resultJSON string
		if err := rows.Scan(&resultJSON); err != nil {
			return nil, err
		}
		var comp BaselineComparison
		if err := json.Unmarshal([]byte(resultJSON), &comp); err != nil {
			continue
		}
		comparisons = append(comparisons, comp)
	}
	return comparisons, rows.Err()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func generateBaselineID(pipelineID, runID string, frozenAt time.Time) string {
	data := fmt.Sprintf("%s:%s:%d", pipelineID, runID, frozenAt.UnixNano())
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("bl-%x", hash[:8])
}

func computeEventLogHash(events []map[string]interface{}) string {
	b, _ := json.Marshal(events)
	hash := sha256.Sum256(b)
	return fmt.Sprintf("%x", hash)
}

func computeBaselineFingerprint(id string, stepProofs, artifactHashes map[string]string) string {
	// Sort keys for determinism
	stepKeys := make([]string, 0, len(stepProofs))
	for k := range stepProofs {
		stepKeys = append(stepKeys, k)
	}
	sort.Strings(stepKeys)

	artifactKeys := make([]string, 0, len(artifactHashes))
	for k := range artifactHashes {
		artifactKeys = append(artifactKeys, k)
	}
	sort.Strings(artifactKeys)

	data := map[string]interface{}{
		"id":              id,
		"step_proofs":     stepProofs,
		"artifact_hashes": artifactHashes,
	}
	b, _ := json.Marshal(data)
	hash := sha256.Sum256(b)
	return fmt.Sprintf("%x", hash)
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
