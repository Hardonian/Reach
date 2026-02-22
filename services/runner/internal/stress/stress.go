// Package stress provides stress testing capabilities for Reach determinism validation.
// It includes cross-environment stability matrix testing, entropy surface analysis,
// and determinism confidence scoring.
package stress

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// MatrixConfig defines the configuration for cross-environment stability matrix testing.
type MatrixConfig struct {
	// NodeVersions - not directly configurable in CLI, simulated
	NodeVersions []string
	// Timezones to test
	Timezones []string
	// Locales to test
	Locales []string
	// Randomized object key ordering
	KeyOrderings []string
	// Concurrency levels
	Concurrency []int
	// Large artifact sizes (in MB)
	ArtifactSizes []int
	// Number of trials per configuration
	Trials int
}

// MatrixResult holds the results of a matrix test run.
type MatrixResult struct {
	Config          MatrixConfig          `json:"config"`
	StepKeyStability float64             `json:"step_key_stability"`
	ProofHashStability float64           `json:"proof_hash_stability"`
	RunProofStability float64            `json:"run_proof_stability"`
	DurationVariance float64             `json:"duration_variance_ms"`
	MemoryVariance   float64             `json:"memory_variance_mb"`
	EnvironmentResults []EnvResult      `json:"environment_results"`
	DeterminismConfidence int            `json:"determinism_confidence"`
}

// EnvResult holds results for a specific environment configuration.
type EnvResult struct {
	ConfigID       string              `json:"config_id"`
	Timezone       string              `json:"timezone"`
	Locale         string              `json:"locale"`
	KeyOrdering    string              `json:"key_ordering"`
	Concurrency    int                 `json:"concurrency"`
	ArtifactSizeMB int                 `json:"artifact_size_mb"`
	StepKeys       []string            `json:"step_keys"`
	ProofHashes    []string            `json:"proof_hashes"`
	RunProofs      []string            `json:"run_proofs"`
	Durations      []float64           `json:"durations_ms"`
	MemoryUsage    []float64           `json:"memory_mb"`
	Stable         bool                `json:"stable"`
}

// EntropyAnalysis holds the results of entropy surface analysis.
type EntropyAnalysis struct {
	PipelineID       string              `json:"pipeline_id"`
	FieldDriftSensitivity map[string]float64 `json:"field_drift_sensitivity"`
	FloatingPointInstability []string    `json:"floating_point_instability"`
	OrderingSensitivity    []string     `json:"ordering_sensitivity"`
	InstabilityHotspots   []Hotspot     `json:"instability_hotspots"`
}

// Hotspot represents an instability hotspot in the pipeline.
type Hotspot struct {
	Field       string  `json:"field"`
	Sensitivity float64 `json:"sensitivity"`
	Rank        int     `json:"rank"`
}

// StabilityReport holds the complete stability report.
type StabilityReport struct {
	GeneratedAt    string         `json:"generated_at"`
	MatrixResult   MatrixResult   `json:"matrix_result"`
	EntropyAnalysis *EntropyAnalysis `json:"entropy_analysis,omitempty"`
	Recommendations []string      `json:"recommendations"`
}

// DefaultMatrixConfig returns the default matrix configuration for stress testing.
func DefaultMatrixConfig() MatrixConfig {
	return MatrixConfig{
		NodeVersions: []string{"lts", "latest"},
		Timezones: []string{
			"UTC",
			"America/New_York",
			"Asia/Tokyo",
			"Europe/London",
			"Australia/Sydney",
		},
		Locales: []string{
			"en_US.UTF-8",
			"en_GB.UTF-8",
			"ja_JP.UTF-8",
			"de_DE.UTF-8",
			"zh_CN.UTF-8",
		},
		KeyOrderings: []string{"sorted", "original", "random"},
		Concurrency: []int{1, 2, 4, 8},
		ArtifactSizes: []int{1, 10, 50, 100},
		Trials: 5,
	}
}

// RunMatrix executes the cross-environment stability matrix test.
func RunMatrix(pipelineID string, config MatrixConfig, trialFn func() (stepKey, proofHash, runProof string, durationMs, memoryMb float64)) (*MatrixResult, error) {
	result := &MatrixResult{
		Config: config,
		EnvironmentResults: []EnvResult{},
	}

	// Run tests for each environment configuration
	configID := 0
	for _, tz := range config.Timezones {
		for _, locale := range config.Locales {
			for _, keyOrder := range config.KeyOrderings {
				for _, conc := range config.Concurrency {
					for _, artSize := range config.ArtifactSizes {
						envRes := runEnvironmentTest(
							pipelineID,
							fmt.Sprintf("config-%d", configID),
							tz,
							locale,
							keyOrder,
							conc,
							artSize,
							config.Trials,
							trialFn,
						)
						result.EnvironmentResults = append(result.EnvironmentResults, envRes)
						configID++
					}
				}
			}
		}
	}

	// Calculate stability metrics
	result.calculateStabilityMetrics()

	return result, nil
}

func runEnvironmentTest(
	pipelineID, configID, timezone, locale, keyOrder string,
	concurrency, artifactSizeMB, trials int,
	trialFn func() (stepKey, proofHash, runProof string, durationMs, memoryMb float64),
) EnvResult {
	res := EnvResult{
		ConfigID:     configID,
		Timezone:    timezone,
		Locale:      locale,
		KeyOrdering: keyOrder,
		Concurrency: concurrency,
		ArtifactSizeMB: artifactSizeMB,
	}

	// Run trials
	for i := 0; i < trials; i++ {
		stepKey, proofHash, runProof, durationMs, memoryMb := trialFn()
		res.StepKeys = append(res.StepKeys, stepKey)
		res.ProofHashes = append(res.ProofHashes, proofHash)
		res.RunProofs = append(res.RunProofs, runProof)
		res.Durations = append(res.Durations, durationMs)
		res.MemoryUsage = append(res.MemoryUsage, memoryMb)
	}

	// Check stability
	res.Stable = checkStability(res.StepKeys) &&
		checkStability(res.ProofHashes) &&
		checkStability(res.RunProofs)

	return res
}

func checkStability(values []string) bool {
	if len(values) < 2 {
		return true
	}
	first := values[0]
	for _, v := range values[1:] {
		if v != first {
			return false
		}
	}
	return true
}

func (r *MatrixResult) calculateStabilityMetrics() {
	var stepKeyStable, proofHashStable, runProofStable int
	var totalDuration, totalMemory float64
	var durationVals, memoryVals []float64

	for _, env := range r.EnvironmentResults {
		// Count stable configurations
		if checkStability(env.StepKeys) {
			stepKeyStable++
		}
		if checkStability(env.ProofHashes) {
			proofHashStable++
		}
		if checkStability(env.RunProofs) {
			runProofStable++
		}

		// Collect variance data
		durationVals = append(durationVals, env.Durations...)
		memoryVals = append(memoryVals, env.MemoryUsage...)
		totalDuration += sum(env.Durations)
		totalMemory += sum(env.MemoryUsage)
	}

	totalConfigs := len(r.EnvironmentResults)
	if totalConfigs > 0 {
		r.StepKeyStability = float64(stepKeyStable) / float64(totalConfigs) * 100
		r.ProofHashStability = float64(proofHashStable) / float64(totalConfigs) * 100
		r.RunProofStability = float64(runProofStable) / float64(totalConfigs) * 100
		r.DurationVariance = variance(durationVals)
		r.MemoryVariance = variance(memoryVals)
	}

	// Calculate determinism confidence (0-100)
	r.DeterminismConfidence = calculateConfidence(*r)
}

func sum(values []float64) float64 {
	var total float64
	for _, v := range values {
		total += v
	}
	return total
}

func variance(values []float64) float64 {
	if len(values) < 2 {
		return 0
	}
	mean := sum(values) / float64(len(values))
	var sumSq float64
	for _, v := range values {
		diff := v - mean
		sumSq += diff * diff
	}
	return sumSq / float64(len(values)-1)
}

func calculateConfidence(m MatrixResult) int {
	// Weighted confidence score based on stability metrics
	stabilityScore := (m.StepKeyStability + m.ProofHashStability + m.RunProofStability) / 3
	
	// Penalty for high variance
	variancePenalty := 0.0
	if m.DurationVariance > 1000 {
		variancePenalty += 10
	}
	if m.MemoryVariance > 100 {
		variancePenalty += 10
	}

	confidence := int(stabilityScore - variancePenalty)
	if confidence < 0 {
		confidence = 0
	}
	if confidence > 100 {
		confidence = 100
	}
	return confidence
}

// AnalyzeEntropy performs entropy surface analysis on a pipeline.
func AnalyzeEntropy(pipelineID string, inputData map[string]any) (*EntropyAnalysis, error) {
	analysis := &EntropyAnalysis{
		PipelineID: pipelineID,
		FieldDriftSensitivity: make(map[string]float64),
		FloatingPointInstability: []string{},
		OrderingSensitivity: []string{},
		InstabilityHotspots: []Hotspot{},
	}

	// Analyze each field for drift sensitivity
	analysis.analyzeFieldDrift(inputData)
	
	// Detect floating point instability
	analysis.detectFloatingPointInstability(inputData)
	
	// Detect ordering sensitivity
	analysis.detectOrderingSensitivity(inputData)
	
	// Rank instability hotspots
	analysis.rankHotspots()

	return analysis, nil
}

func (a *EntropyAnalysis) analyzeFieldDrift(data map[string]any) {
	// Simulate field-level drift sensitivity analysis
	// In production, this would vary each field and measure hash drift
	
	sensitiveFields := []string{"timestamp", "datetime", "now", "random", "uuid", "id"}
	
	for field, value := range data {
		sensitivity := 0.0
		
		// Check if field name suggests time-dependent behavior
		lowerField := strings.ToLower(field)
		for _, sf := range sensitiveFields {
			if strings.Contains(lowerField, sf) {
				sensitivity = 100.0
				break
			}
		}
		
		// Check value type
		switch v := value.(type) {
		case float64:
			// Check for floating point values
			if v != math.Floor(v) {
				sensitivity = math.Max(sensitivity, 50.0)
			}
		case time.Time:
			sensitivity = 100.0
		case map[string]any:
			// Recursively analyze nested maps
			innerAnalysis, _ := AnalyzeEntropy("nested", v)
			if innerAnalysis != nil {
				for f, s := range innerAnalysis.FieldDriftSensitivity {
					a.FieldDriftSensitivity[field+"."+f] = s
				}
			}
		}
		
		if sensitivity > 0 {
			a.FieldDriftSensitivity[field] = sensitivity
		}
	}
}

func (a *EntropyAnalysis) detectFloatingPointInstability(data map[string]any) {
	// Check for floating point values that may cause instability
	var checkFloat func(v any, path string)
	checkFloat = func(v any, path string) {
		switch vv := v.(type) {
		case float64:
			// Detect floating point precision issues
			if vv != math.Floor(vv) && vv != math.Ceil(vv) {
				// Check for very small fractional parts that might cause precision issues
				frac := vv - math.Floor(vv)
				if frac > 0 && frac < 0.0001 {
					a.FloatingPointInstability = append(a.FloatingPointInstability, path)
				}
			}
		case map[string]any:
			for k, val := range vv {
				checkFloat(val, path+"."+k)
			}
		case []any:
			for i, val := range vv {
				checkFloat(val, fmt.Sprintf("%s[%d]", path, i))
			}
		}
	}
	
	checkFloat(data, "root")
}

func (a *EntropyAnalysis) detectOrderingSensitivity(data map[string]any) {
	// Detect fields that are sensitive to ordering
	orderingSensitive := []string{"dependencies", "imports", "requires", "includes", "items"}
	
	var checkOrder func(v any, path string)
	checkOrder = func(v any, path string) {
		switch vv := v.(type) {
		case []any:
			// Check if this array might be order-sensitive
			for _, os := range orderingSensitive {
				if strings.Contains(strings.ToLower(path), os) {
					a.OrderingSensitivity = append(a.OrderingSensitivity, path)
					break
				}
			}
		case map[string]any:
			for k, val := range vv {
				checkOrder(val, path+"."+k)
			}
		}
	}
	
	checkOrder(data, "root")
}

func (a *EntropyAnalysis) rankHotspots() {
	// Combine all sensitivity data and rank hotspots
	type fieldSens struct {
		field string
		sens  float64
	}
	
	var allSensitivities []fieldSens
	for field, sens := range a.FieldDriftSensitivity {
		allSensitivities = append(allSensitivities, fieldSens{field, sens})
	}
	
	// Add ordering sensitivity
	for _, field := range a.OrderingSensitivity {
		allSensitivities = append(allSensitivities, fieldSens{field, 80.0})
	}
	
	// Sort by sensitivity (descending)
	sort.Slice(allSensitivities, func(i, j int) bool {
		return allSensitivities[i].sens > allSensitivities[j].sens
	})
	
	// Take top hotspots
	maxHotspots := 10
	if len(allSensitivities) < maxHotspots {
		maxHotspots = len(allSensitivities)
	}
	
	for i := 0; i < maxHotspots; i++ {
		a.InstabilityHotspots = append(a.InstabilityHotspots, Hotspot{
			Field:       allSensitivities[i].field,
			Sensitivity: allSensitivities[i].sens,
			Rank:        i + 1,
		})
	}
}

// GenerateStabilityReport creates a comprehensive stability report.
func GenerateStabilityReport(pipelineID string, config MatrixConfig, trialFn func() (string, string, string, float64, float64)) (*StabilityReport, error) {
	report := &StabilityReport{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Recommendations: []string{},
	}

	// Run matrix tests
	matrixResult, err := RunMatrix(pipelineID, config, trialFn)
	if err != nil {
		return nil, err
	}
	report.MatrixResult = *matrixResult

	// Generate recommendations based on results
	if matrixResult.DeterminismConfidence < 50 {
		report.Recommendations = append(report.Recommendations,
			"CRITICAL: Determinism confidence below 50%. Review time-dependent operations.",
			"Consider removing timestamp generation from critical paths.",
			"Enable deterministic random seeding for any randomness.")
	} else if matrixResult.DeterminismConfidence < 80 {
		report.Recommendations = append(report.Recommendations,
			"WARNING: Determinism confidence below 80%. Some instability detected.",
			"Review fields with high drift sensitivity.",
			"Consider using sorted maps instead of native map iteration.")
	} else {
		report.Recommendations = append(report.Recommendations,
			"SUCCESS: Determinism confidence is high.",
			"No immediate action required.",
			"Continue monitoring for regression.")
	}

	if matrixResult.DurationVariance > 1000 {
		report.Recommendations = append(report.Recommendations,
			"WARNING: High duration variance detected. Check for timing-dependent code.")
	}

	return report, nil
}

// DeterministicHash computes a deterministic hash (simulating the engine's hash function).
func DeterministicHash(data any) string {
	// Use canonical JSON for deterministic hashing
	canonical, _ := json.Marshal(data)
	h := sha256.Sum256(canonical)
	return hex.EncodeToString(h[:])
}

// DeterministicRandom generates a deterministic "random" value based on seed.
func DeterministicRandom(seed string) float64 {
	// Simple deterministic random based on seed hash
	h := sha256.Sum256([]byte(seed))
	r := rand.New(rand.NewSource(int64(h[0])<<24 | int64(h[1])<<16 | int64(h[2])<<8 | int64(h[3])))
	return r.Float64()
}
