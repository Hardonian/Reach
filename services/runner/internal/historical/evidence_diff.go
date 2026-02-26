// Package historical provides historical intelligence capabilities for Reach runs.
package historical

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// SECURITY: Path Traversal Protection
// ============================================================================

// maxRequestIDLength is the maximum allowed length for request IDs
const maxRequestIDLength = 64

// validRequestIDRegex matches only safe characters for request IDs
// Allows: alphanumeric, dash, underscore, dot
var validRequestIDRegex = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

// SanitizeRequestID sanitizes a request ID to prevent path traversal attacks.
// It removes any characters that could be used for directory traversal and
// limits the length to prevent buffer overflow issues.
//
// SECURITY: This function MUST be called on all request IDs before using
// them in file paths.
func SanitizeRequestID(requestID string) string {
	// Remove any characters that aren't alphanumeric, dash, underscore, or dot
	sanitized := regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(requestID, "_")

	// Remove leading dots and dashes (prevent hidden files)
	sanitized = strings.TrimLeft(sanitized, ".-")

	// Limit length
	if len(sanitized) > maxRequestIDLength {
		sanitized = sanitized[:maxRequestIDLength]
	}

	// Handle empty result
	if sanitized == "" {
		return "invalid_request_id"
	}

	return sanitized
}

// ContainsPathTraversal checks if a path contains directory traversal sequences.
// Returns true if the path contains ".." patterns that could escape the base directory.
func ContainsPathTraversal(filePath string) bool {
	// Normalize path separators
	normalized := strings.ReplaceAll(filePath, "\\", "/")

	// Check for traversal patterns
	traversalPatterns := []string{
		"../",
		"/../",
		"..../", // Unicode attack variant
	}

	for _, pattern := range traversalPatterns {
		if strings.Contains(normalized, pattern) {
			return true
		}
	}

	// Check for path starting with ".."
	if strings.HasPrefix(normalized, "../") || strings.HasPrefix(normalized, "..") {
		return true
	}

	return false
}

// ValidateDiffReportPath validates that a diff report path is within the expected
// base directory and does not contain path traversal sequences.
//
// SECURITY: All diff report paths must be validated through this function
// before file operations.
func ValidateDiffReportPath(requestID, baseDir string) (string, error) {
	// Sanitize the request ID
	sanitizedID := SanitizeRequestID(requestID)

	// If sanitization changed the ID, log the original for debugging
	// (but don't use it in the path)
	if sanitizedID != requestID {
		// Original request ID will be stored in JSON metadata, not filename
		_ = requestID // Mark as used for metadata
	}

	// Build the filename
	filename := fmt.Sprintf("diff_%s.json", sanitizedID)

	// Join with base directory
	fullPath := filepath.Join(baseDir, filename)

	// Resolve to absolute path
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path: %w", err)
	}

	// Resolve base directory to absolute
	absBaseDir, err := filepath.Abs(baseDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve base dir: %w", err)
	}

	// Ensure the path is within the base directory
	// Use filepath.Clean to normalize before prefix check
	cleanPath := filepath.Clean(absPath)
	cleanBaseDir := filepath.Clean(absBaseDir)

	// On Windows, add trailing separator to ensure proper prefix match
	if !strings.HasSuffix(cleanBaseDir, string(filepath.Separator)) {
		cleanBaseDir += string(filepath.Separator)
	}

	if !strings.HasPrefix(cleanPath, cleanBaseDir) && cleanPath != filepath.Clean(absBaseDir) {
		return "", fmt.Errorf("path escapes base directory: %s", sanitizedID)
	}

	return absPath, nil
}

// ============================================================================
// EVIDENCE DIFF VISUAL MODEL - Core Data Structures
// ============================================================================

// EvidenceDiff represents a comprehensive diff between two runs with visualization data.
type EvidenceDiff struct {
	ReferenceRunID    string            `json:"reference_run_id"`
	ComparisonRunID   string            `json:"comparison_run_id"`
	GeneratedAt       time.Time         `json:"generated_at"`
	HistoricalOverlay []HistoricalPoint `json:"historical_overlay"`
	ChangeIntensity   ChangeIntensity   `json:"change_intensity"`
	StepVolatility    []StepVolatility  `json:"step_volatility"`
	Visualization     VisualizationData `json:"visualization"`
	// SECURITY: Original request IDs stored in metadata (not used in filenames)
	OriginalRequestIDs struct {
		Reference  string `json:"reference_original,omitempty"`
		Comparison string `json:"comparison_original,omitempty"`
	} `json:"_original_request_ids,omitempty"`
}

// HistoricalPoint represents a point in the historical overlay.
type HistoricalPoint struct {
	Timestamp   time.Time `json:"timestamp"`
	RunID       string    `json:"run_id"`
	StepCount   int       `json:"step_count"`
	Fingerprint string    `json:"fingerprint"`
	Similarity  float64   `json:"similarity"`
	Color       string    `json:"color"`
}

// ChangeIntensity represents the change intensity analysis.
type ChangeIntensity struct {
	Score             float64      `json:"score"` // 0-1
	Level             string       `json:"level"` // "minimal", "low", "moderate", "high", "extreme"
	ModifiedSteps     int          `json:"modified_steps"`
	AddedSteps        int          `json:"added_steps"`
	RemovedSteps      int          `json:"removed_steps"`
	ModifiedArtifacts int          `json:"modified_artifacts"`
	StepBreakdown     []StepChange `json:"step_breakdown"`
}

// StepChange represents a change to a specific step.
type StepChange struct {
	StepIndex  int     `json:"step_index"`
	StepKey    string  `json:"step_key"`
	ChangeType string  `json:"change_type"` // "added", "removed", "modified", "unchanged"
	Intensity  float64 `json:"intensity"`   // 0-1
	HashBefore string  `json:"hash_before,omitempty"`
	HashAfter  string  `json:"hash_after,omitempty"`
	RiskLevel  string  `json:"risk_level"` // "low", "medium", "high"
}

// StepVolatility represents the volatility ranking of a step.
type StepVolatility struct {
	StepKey        string         `json:"step_key"`
	Rank           int            `json:"rank"`
	Volatility     float64        `json:"volatility"` // 0-1
	History        []HistoryPoint `json:"history"`
	TrendDirection string         `json:"trend_direction"` // "increasing", "decreasing", "stable"
	RiskScore      float64        `json:"risk_score"`
}

// HistoryPoint represents a single historical data point.
type HistoryPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// VisualizationData contains data for visualization rendering.
type VisualizationData struct {
	GraphType   string       `json:"graph_type"` // "timeline", "heatmap", "diff"
	Nodes       []VisualNode `json:"nodes"`
	Edges       []VisualEdge `json:"edges"`
	ColorScheme ColorScheme  `json:"color_scheme"`
	Layout      LayoutConfig `json:"layout"`
	Legend      LegendConfig `json:"legend"`
	Annotations []Annotation `json:"annotations"`
}

// VisualNode represents a node in the visualization.
type VisualNode struct {
	ID       string                 `json:"id"`
	Label    string                 `json:"label"`
	Type     string                 `json:"type"` // "step", "artifact", "event"
	Position Position               `json:"position"`
	Style    NodeStyle              `json:"style"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Position represents a 2D position.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// NodeStyle represents the visual style of a node.
type NodeStyle struct {
	Fill        string  `json:"fill"`
	Stroke      string  `json:"stroke"`
	StrokeWidth float64 `json:"stroke_width"`
	Opacity     float64 `json:"opacity"`
	Radius      float64 `json:"radius"`
}

// VisualEdge represents an edge in the visualization.
type VisualEdge struct {
	From     string      `json:"from"`
	To       string      `json:"to"`
	Type     string      `json:"type"` // "dependency", "data_flow", "comparison"
	Style    EdgeStyle   `json:"style"`
	Label    string      `json:"label,omitempty"`
	Metadata interface{} `json:"metadata,omitempty"`
}

// EdgeStyle represents the visual style of an edge.
type EdgeStyle struct {
	Stroke      string  `json:"stroke"`
	StrokeWidth float64 `json:"stroke_width"`
	Opacity     float64 `json:"opacity"`
	DashArray   string  `json:"dash_array,omitempty"`
}

// ColorScheme defines the color scheme for visualization.
type ColorScheme struct {
	Added     string   `json:"added"`
	Removed   string   `json:"removed"`
	Modified  string   `json:"modified"`
	Unchanged string   `json:"unchanged"`
	HighRisk  string   `json:"high_risk"`
	LowRisk   string   `json:"low_risk"`
	Timeline  []string `json:"timeline"`
}

// LayoutConfig defines layout configuration.
type LayoutConfig struct {
	Type      string  `json:"type"` // "horizontal", "vertical", "radial"
	Direction string  `json:"direction"`
	Spacing   float64 `json:"spacing"`
	Animation bool    `json:"animation"`
}

// LegendConfig defines legend configuration.
type LegendConfig struct {
	Show        bool   `json:"show"`
	Position    string `json:"position"`    // "top", "bottom", "left", "right"
	Orientation string `json:"orientation"` // "horizontal", "vertical"
}

// Annotation represents an annotation on the visualization.
type Annotation struct {
	Type      string  `json:"type"` // "arrow", "box", "text"
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Content   string  `json:"content"`
	Style     string  `json:"style,omitempty"`
	Direction string  `json:"direction,omitempty"`
}

// ============================================================================
// EVIDENCE DIFF MANAGER
// ============================================================================

// EvidenceDiffManager manages evidence diff computation.
type EvidenceDiffManager struct {
	db      *sql.DB
	mu      sync.RWMutex
	dataDir string
	index   *LineageIndex
}

// NewEvidenceDiffManager creates a new evidence diff manager.
func NewEvidenceDiffManager(dataDir string, index *LineageIndex) (*EvidenceDiffManager, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "evidence_diff.db")
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_sync=NORMAL")
	if err != nil {
		return nil, err
	}
	mgr := &EvidenceDiffManager{db: db, dataDir: dataDir, index: index}
	if err := mgr.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return mgr, nil
}

// migrate creates the necessary tables.
func (m *EvidenceDiffManager) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS diff_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			reference_run_id TEXT NOT NULL,
			comparison_run_id TEXT NOT NULL,
			generated_at TIMESTAMP NOT NULL,
			result_json TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS step_volatility_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			step_key TEXT NOT NULL,
			timestamp TIMESTAMP NOT NULL,
			volatility REAL NOT NULL,
			run_id TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_volatility_step ON step_volatility_history(step_key)`,
	}
	for _, q := range queries {
		if _, err := m.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection.
func (m *EvidenceDiffManager) Close() error {
	return m.db.Close()
}

// ============================================================================
// DIFF COMPUTATION
// ============================================================================

// ComputeEvidenceDiff computes a comprehensive evidence diff between two runs.
func (m *EvidenceDiffManager) ComputeEvidenceDiff(ctx context.Context, referenceRunID, comparisonRunID string,
	referenceEvents, comparisonEvents []map[string]interface{}) (*EvidenceDiff, error) {

	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	diff := &EvidenceDiff{
		ReferenceRunID:  referenceRunID,
		ComparisonRunID: comparisonRunID,
		GeneratedAt:     now,
	}

	// SECURITY: Store original request IDs in metadata (sanitized in filename)
	diff.OriginalRequestIDs.Reference = referenceRunID
	diff.OriginalRequestIDs.Comparison = comparisonRunID

	// 1. Build historical overlay
	diff.HistoricalOverlay = m.buildHistoricalOverlay(ctx, referenceRunID, comparisonRunID)

	// 2. Compute change intensity
	diff.ChangeIntensity = m.computeChangeIntensity(referenceEvents, comparisonEvents)

	// 3. Compute step volatility
	diff.StepVolatility = m.computeStepVolatility(ctx, referenceEvents, comparisonEvents)

	// 4. Build visualization data
	diff.Visualization = m.buildVisualizationData(diff)

	// 5. Save to database (uses sanitized IDs)
	resultJSON, _ := json.Marshal(diff)
	m.db.ExecContext(ctx, `
		INSERT INTO diff_snapshots (reference_run_id, comparison_run_id, generated_at, result_json)
		VALUES (?, ?, ?, ?)
	`, SanitizeRequestID(referenceRunID), SanitizeRequestID(comparisonRunID), now, string(resultJSON))

	return diff, nil
}

// buildHistoricalOverlay builds the historical overlay data.
func (m *EvidenceDiffManager) buildHistoricalOverlay(ctx context.Context, referenceRunID, comparisonRunID string) []HistoricalPoint {
	var points []HistoricalPoint

	// Get recent runs for the same pipeline (simulated)
	// In practice, this would query from the lineage index
	colors := []string{"#4CAF50", "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800"}

	// Get runs with similar artifacts
	similarRuns, _ := m.index.SearchSimilar(ctx, referenceRunID, 10)

	for i, run := range similarRuns {
		colorIdx := i % len(colors)
		points = append(points, HistoricalPoint{
			Timestamp:   run.Timestamp,
			RunID:       run.RunID,
			StepCount:   run.CommonSteps,
			Fingerprint: fmt.Sprintf("%x", run.RunID)[:16],
			Similarity:  run.SimilarityScore,
			Color:       colors[colorIdx],
		})
	}

	now := time.Now().UTC()

	// Add reference and comparison runs (use sanitized IDs)
	points = append(points, HistoricalPoint{
		Timestamp:   now,
		RunID:       SanitizeRequestID(referenceRunID),
		StepCount:   0, // Would come from actual data
		Fingerprint: fmt.Sprintf("%x", referenceRunID)[:16],
		Similarity:  1.0,
		Color:       "#2196F3", // Blue for reference
	})

	points = append(points, HistoricalPoint{
		Timestamp:   now,
		RunID:       SanitizeRequestID(comparisonRunID),
		StepCount:   0,
		Fingerprint: fmt.Sprintf("%x", comparisonRunID)[:16],
		Similarity:  0.0,
		Color:       "#F44336", // Red for comparison
	})

	// Sort by timestamp
	sort.Slice(points, func(i, j int) bool {
		return points[i].Timestamp.Before(points[j].Timestamp)
	})

	return points
}

// computeChangeIntensity computes the change intensity analysis.
func (m *EvidenceDiffManager) computeChangeIntensity(referenceEvents, comparisonEvents []map[string]interface{}) ChangeIntensity {
	ci := ChangeIntensity{}

	// Build reference step hash map
	refSteps := make(map[string]StepInfo)
	for i, event := range referenceEvents {
		stepKey := extractStepKey(event)
		proofHash := computeStepProofHash("", i, event)
		refSteps[stepKey] = StepInfo{
			Index:     i,
			ProofHash: proofHash,
			Event:     event,
		}
	}

	// Compare with comparison events
	compSteps := make(map[string]StepInfo)
	for i, event := range comparisonEvents {
		stepKey := extractStepKey(event)
		proofHash := computeStepProofHash("", i, event)
		compSteps[stepKey] = StepInfo{
			Index:     i,
			ProofHash: proofHash,
			Event:     event,
		}
	}

	// Find added, removed, modified steps
	for key, ref := range refSteps {
		comp, exists := compSteps[key]
		if !exists {
			ci.RemovedSteps++
			ci.StepBreakdown = append(ci.StepBreakdown, StepChange{
				StepIndex:  ref.Index,
				StepKey:    key,
				ChangeType: "removed",
				Intensity:  1.0,
				HashBefore: ref.ProofHash,
				RiskLevel:  "high",
			})
			continue
		}

		if ref.ProofHash != comp.ProofHash {
			ci.ModifiedSteps++
			ci.StepBreakdown = append(ci.StepBreakdown, StepChange{
				StepIndex:  comp.Index,
				StepKey:    key,
				ChangeType: "modified",
				Intensity:  computeHashDistance(ref.ProofHash, comp.ProofHash),
				HashBefore: ref.ProofHash,
				HashAfter:  comp.ProofHash,
				RiskLevel:  "medium",
			})
		} else {
			ci.StepBreakdown = append(ci.StepBreakdown, StepChange{
				StepIndex:  comp.Index,
				StepKey:    key,
				ChangeType: "unchanged",
				Intensity:  0.0,
				RiskLevel:  "low",
			})
		}
	}

	// Find added steps
	for key, comp := range compSteps {
		if _, exists := refSteps[key]; !exists {
			ci.AddedSteps++
			ci.StepBreakdown = append(ci.StepBreakdown, StepChange{
				StepIndex:  comp.Index,
				StepKey:    key,
				ChangeType: "added",
				Intensity:  0.5,
				HashAfter:  comp.ProofHash,
				RiskLevel:  "medium",
			})
		}
	}

	// Calculate overall score
	totalSteps := len(referenceEvents)
	if totalSteps == 0 {
		totalSteps = 1
	}
	ci.Score = float64(ci.ModifiedSteps+ci.AddedSteps+ci.RemovedSteps) / float64(totalSteps)
	if ci.Score > 1.0 {
		ci.Score = 1.0
	}

	// Determine level
	switch {
	case ci.Score < 0.1:
		ci.Level = "minimal"
	case ci.Score < 0.3:
		ci.Level = "low"
	case ci.Score < 0.5:
		ci.Level = "moderate"
	case ci.Score < 0.8:
		ci.Level = "high"
	default:
		ci.Level = "extreme"
	}

	// Sort by intensity
	sort.Slice(ci.StepBreakdown, func(i, j int) bool {
		return ci.StepBreakdown[i].Intensity > ci.StepBreakdown[j].Intensity
	})

	return ci
}

// computeStepVolatility computes step volatility rankings.
func (m *EvidenceDiffManager) computeStepVolatility(ctx context.Context, referenceEvents, comparisonEvents []map[string]interface{}) []StepVolatility {
	var volatilities []StepVolatility

	// Build step volatility from events
	stepChanges := make(map[string]int)
	for _, event := range referenceEvents {
		stepKey := extractStepKey(event)
		stepChanges[stepKey]++
	}
	for _, event := range comparisonEvents {
		stepKey := extractStepKey(event)
		stepChanges[stepKey]++
	}

	// Get top volatile steps
	type stepVol struct {
		key         string
		changeCount int
	}
	var steps []stepVol
	for key, count := range stepChanges {
		steps = append(steps, stepVol{key: key, changeCount: count})
	}

	// Sort by change count
	sort.Slice(steps, func(i, j int) bool {
		return steps[i].changeCount > steps[j].changeCount
	})

	// Build volatility entries
	for rank, s := range steps {
		vol := float64(s.changeCount) / 10.0
		if vol > 1.0 {
			vol = 1.0
		}

		riskScore := vol * 100

		var trend string
		switch {
		case vol > 0.5:
			trend = "increasing"
		case vol < 0.2:
			trend = "decreasing"
		default:
			trend = "stable"
		}

		volatilities = append(volatilities, StepVolatility{
			StepKey:        s.key,
			Rank:           rank + 1,
			Volatility:     vol,
			History:        []HistoryPoint{}, // Would come from DB in practice
			TrendDirection: trend,
			RiskScore:      riskScore,
		})
	}

	return volatilities
}

// buildVisualizationData builds the visualization data.
func (m *EvidenceDiffManager) buildVisualizationData(diff *EvidenceDiff) VisualizationData {
	vd := VisualizationData{
		GraphType:   "diff",
		Nodes:       []VisualNode{},
		Edges:       []VisualEdge{},
		ColorScheme: defaultColorScheme(),
		Layout: LayoutConfig{
			Type:      "horizontal",
			Direction: "left-to-right",
			Spacing:   100,
			Animation: true,
		},
		Legend: LegendConfig{
			Show:        true,
			Position:    "bottom",
			Orientation: "horizontal",
		},
		Annotations: []Annotation{},
	}

	// Build nodes for each step in the change breakdown
	nodeMap := make(map[string]*VisualNode)
	for i, change := range diff.ChangeIntensity.StepBreakdown {
		nodeID := fmt.Sprintf("step_%d", change.StepIndex)

		var fill string
		switch change.ChangeType {
		case "added":
			fill = vd.ColorScheme.Added
		case "removed":
			fill = vd.ColorScheme.Removed
		case "modified":
			fill = vd.ColorScheme.Modified
		default:
			fill = vd.ColorScheme.Unchanged
		}

		vd.Nodes = append(vd.Nodes, VisualNode{
			ID:    nodeID,
			Label: change.StepKey,
			Type:  "step",
			Position: Position{
				X: float64(i) * vd.Layout.Spacing,
				Y: 100,
			},
			Style: NodeStyle{
				Fill:        fill,
				Stroke:      "#333",
				StrokeWidth: 2,
				Opacity:     1.0,
				Radius:      20,
			},
			Metadata: map[string]interface{}{
				"change_type": change.ChangeType,
				"intensity":   change.Intensity,
				"risk_level":  change.RiskLevel,
			},
		})
		nodeMap[nodeID] = &vd.Nodes[len(vd.Nodes)-1]
	}

	// Build edges for sequential dependencies
	for i := 0; i < len(vd.Nodes)-1; i++ {
		fromID := vd.Nodes[i].ID
		toID := vd.Nodes[i+1].ID

		vd.Edges = append(vd.Edges, VisualEdge{
			From: fromID,
			To:   toID,
			Type: "dependency",
			Style: EdgeStyle{
				Stroke:      "#999",
				StrokeWidth: 2,
				Opacity:     0.7,
			},
		})
	}

	// Add annotations for high-risk changes
	for _, change := range diff.ChangeIntensity.StepBreakdown {
		if change.RiskLevel == "high" {
			vd.Annotations = append(vd.Annotations, Annotation{
				Type:    "text",
				X:       float64(change.StepIndex) * vd.Layout.Spacing,
				Y:       50,
				Content: "⚠️ " + change.RiskLevel,
				Style:   "bold",
			})
		}
	}

	// Add historical timeline annotation
	if len(diff.HistoricalOverlay) > 0 {
		vd.Annotations = append(vd.Annotations, Annotation{
			Type:    "text",
			X:       0,
			Y:       0,
			Content: "Historical Timeline (" + strconv.Itoa(len(diff.HistoricalOverlay)) + " runs)",
			Style:   "italic",
		})
	}

	return vd
}

// ============================================================================
// OUTPUT METHODS (SECURITY HARDENED)
// ============================================================================

// WriteDiffJSON writes the diff to a JSON file with path validation.
//
// SECURITY: The requestID is sanitized before use in the filename to prevent
// path traversal attacks.
func (m *EvidenceDiffManager) WriteDiffJSON(diff *EvidenceDiff, outputPath string) error {
	// Validate the path
	baseDir := filepath.Dir(outputPath)
	safePath, err := ValidateDiffReportPath(filepath.Base(outputPath), baseDir)
	if err != nil {
		return fmt.Errorf("path validation failed: %w", err)
	}

	data, err := json.MarshalIndent(diff, "", "  ")
	if err != nil {
		return err
	}

	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(safePath), 0o755); err != nil {
		return err
	}

	return os.WriteFile(safePath, data, 0o644)
}

// WriteDiffMarkdown writes the diff to a Markdown file with path validation.
//
// SECURITY: The requestID is sanitized before use in the filename to prevent
// path traversal attacks.
func (m *EvidenceDiffManager) WriteDiffMarkdown(diff *EvidenceDiff, outputPath string) error {
	// Validate the path
	baseDir := filepath.Dir(outputPath)
	safePath, err := ValidateDiffReportPath(filepath.Base(outputPath), baseDir)
	if err != nil {
		return fmt.Errorf("path validation failed: %w", err)
	}

	var md strings.Builder

	md.WriteString(fmt.Sprintf("# Evidence Diff Report\n\n"))
	md.WriteString(fmt.Sprintf("**Reference Run:** %s\n\n", diff.ReferenceRunID))
	md.WriteString(fmt.Sprintf("**Comparison Run:** %s\n\n", diff.ComparisonRunID))
	md.WriteString(fmt.Sprintf("**Generated:** %s\n\n", diff.GeneratedAt.Format(time.RFC3339)))

	// Change Intensity
	md.WriteString("## Change Intensity\n\n")
	md.WriteString(fmt.Sprintf("- **Score:** %.2f (%s)\n", diff.ChangeIntensity.Score, diff.ChangeIntensity.Level))
	md.WriteString(fmt.Sprintf("- **Modified Steps:** %d\n", diff.ChangeIntensity.ModifiedSteps))
	md.WriteString(fmt.Sprintf("- **Added Steps:** %d\n", diff.ChangeIntensity.AddedSteps))
	md.WriteString(fmt.Sprintf("- **Removed Steps:** %d\n\n", diff.ChangeIntensity.RemovedSteps))

	// Step Breakdown
	if len(diff.ChangeIntensity.StepBreakdown) > 0 {
		md.WriteString("### Step Breakdown\n\n")
		md.WriteString("| Step Key | Type | Intensity | Risk |\n")
		md.WriteString("|----------|------|------------|------|\n")
		for _, change := range diff.ChangeIntensity.StepBreakdown {
			md.WriteString(fmt.Sprintf("| %s | %s | %.2f | %s |\n",
				change.StepKey, change.ChangeType, change.Intensity, change.RiskLevel))
		}
		md.WriteString("\n")
	}

	// Step Volatility
	if len(diff.StepVolatility) > 0 {
		md.WriteString("## Step Volatility Ranking\n\n")
		md.WriteString("| Rank | Step Key | Volatility | Trend | Risk Score |\n")
		md.WriteString("|------|----------|------------|-------|------------|\n")
		for _, vol := range diff.StepVolatility {
			if vol.Rank > 10 {
				break
			}
			md.WriteString(fmt.Sprintf("| %d | %s | %.2f | %s | %.1f |\n",
				vol.Rank, vol.StepKey, vol.Volatility, vol.TrendDirection, vol.RiskScore))
		}
		md.WriteString("\n")
	}

	// Historical Overlay
	if len(diff.HistoricalOverlay) > 0 {
		md.WriteString("## Historical Overlay\n\n")
		md.WriteString(fmt.Sprintf("**Runs in Timeline:** %d\n\n", len(diff.HistoricalOverlay)))
		md.WriteString("| Run ID | Similarity | Timestamp |\n")
		md.WriteString("|--------|-------------|----------|\n")
		for _, point := range diff.HistoricalOverlay {
			md.WriteString(fmt.Sprintf("| %s | %.2f | %s |\n",
				point.RunID[:8], point.Similarity, point.Timestamp.Format("2006-01-02 15:04")))
		}
		md.WriteString("\n")
	}

	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(safePath), 0o755); err != nil {
		return err
	}

	return os.WriteFile(safePath, []byte(md.String()), 0o644)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type StepInfo struct {
	Index     int
	ProofHash string
	Event     map[string]interface{}
}

func computeHashDistance(hash1, hash2 string) float64 {
	if hash1 == hash2 {
		return 0.0
	}
	// Simple distance based on character differences
	diff := 0
	for i := 0; i < len(hash1) && i < len(hash2); i++ {
		if hash1[i] != hash2[i] {
			diff++
		}
	}
	return float64(diff) / float64(len(hash1))
}

func defaultColorScheme() ColorScheme {
	return ColorScheme{
		Added:     "#4CAF50", // Green
		Removed:   "#F44336", // Red
		Modified:  "#FF9800", // Orange
		Unchanged: "#9E9E9E", // Gray
		HighRisk:  "#D32F2F", // Dark Red
		LowRisk:   "#388E3C", // Dark Green
		Timeline:  []string{"#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5", "#2196F3", "#1E88E5", "#1976D2", "#1565C0", "#0D47A1"},
	}
}
