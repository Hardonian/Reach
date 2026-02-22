// Package consensus provides distributed proof consensus and verification capabilities.
// This includes independent re-verification, multi-node consensus simulation,
// byzantine fault detection, and peer trust indexing.
package consensus

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sort"
	"strings"
	"time"
)

// VerificationFile represents the complete verification package for peer re-verification.
type VerificationFile struct {
	// Meta contains metadata about the verification file
	Meta VerificationMeta `json:"meta"`
	// ProofChain contains the cryptographic proof chain
	ProofChain ProofChain `json:"proof_chain"`
	// CanonicalInputs contains hash-only representations of large inputs
	CanonicalInputs map[string]string `json:"canonical_inputs"`
	// ProvenanceSnapshot contains the provenance information
	ProvenanceSnapshot ProvenanceSnapshot `json:"provenance_snapshot"`
	// PluginVersions contains the versions of plugins used
	PluginVersions map[string]string `json:"plugin_versions"`
	// EngineVersion contains the engine version
	EngineVersion string `json:"engine_version"`
	// DeterminismMetadata contains determinism-related metadata
	DeterminismMetadata DeterminismMetadata `json:"determinism_metadata"`
	// EnvFingerprint contains the machine fingerprint (metadata only)
	EnvFingerprint EnvironmentFingerprint `json:"env_fingerprint"`
}

// VerificationMeta contains metadata about the verification file
type VerificationMeta struct {
	RunID           string    `json:"run_id"`
	CreatedAt       time.Time `json:"created_at"`
	ExporterNodeID  string    `json:"exporter_node_id"`
	FileVersion     string    `json:"file_version"`
	OriginalProofHash string  `json:"original_proof_hash"`
}

// ProofChain contains the cryptographic proof chain
type ProofChain struct {
	Events    []string `json:"events"`    // hashes of each event
	Steps     []string `json:"steps"`     // hashes of each step
	RootProof string   `json:"root_proof"` // final proof hash
}

// ProvenanceSnapshot contains provenance information
type ProvenanceSnapshot struct {
	RegistryHash   string    `json:"registry_hash"`
	PolicyHash     string    `json:"policy_hash"`
	PackHash       string    `json:"pack_hash"`
	Timestamp      time.Time `json:"timestamp"`
	FedPath        []string  `json:"fed_path"`
	TrustScores    map[string]float64 `json:"trust_scores"`
}

// DeterminismMetadata contains determinism-related metadata
type DeterminismMetadata struct {
	ConfidenceScore    int      `json:"confidence_score"`
	StableSteps        []string `json:"stable_steps"`
	DriftHistory       []string `json:"drift_history"`
	VerificationTrials int      `json:"verification_trials"`
}

// EnvironmentFingerprint contains normalized machine environment info
type EnvironmentFingerprint struct {
	OS             string `json:"os"`
	Arch           string `json:"arch"`
	EngineVersion  string `json:"engine_version"`
	PluginVersions map[string]string `json:"plugin_versions"`
	// Normalized paths (relative, not absolute)
	NormalizedPaths []string `json:"normalized_paths"`
	// No machine identifiers, timestamps stripped
	DeterministicSalt string `json:"deterministic_salt"`
}

// PeerVerificationReport represents the result of peer verification
type PeerVerificationReport struct {
	RunID                string           `json:"run_id"`
	VerificationFilePath string           `json:"verification_file_path"`
	OriginalProofHash    string           `json:"original_proof_hash"`
	LocalProofHash       string           `json:"local_proof_hash"`
	ProofMatch           bool             `json:"proof_match"`
	StepKeyComparison    StepKeyComparison `json:"step_key_comparison"`
	DivergenceScore      float64          `json:"divergence_score"` // 0-100, 0 = identical
	DivergenceFingerprint DivergenceFingerprint `json:"divergence_fingerprint,omitempty"`
	Timestamp           time.Time        `json:"timestamp"`
	Status              string           `json:"status"` // "verified", "diverged", "error"
}

// StepKeyComparison compares step keys between original and local
type StepKeyComparison struct {
	OriginalSteps []string `json:"original_steps"`
	LocalSteps    []string `json:"local_steps"`
	MatchingSteps int      `json:"matching_steps"`
	TotalSteps    int      `json:"total_steps"`
	MismatchDetails []StepMismatch `json:"mismatch_details"`
}

// StepMismatch details a single step mismatch
type StepMismatch struct {
	StepIndex    int    `json:"step_index"`
	OriginalHash string `json:"original_hash"`
	LocalHash    string `json:"local_hash"`
	Rank         int    `json:"rank"` // probable root cause rank
}

// DivergenceFingerprint contains information about the divergence
type DivergenceFingerprint struct {
	FirstDivergenceStep int      `json:"first_divergence_step"`
	DivergentSteps      []int    `json:"divergent_steps"`
	ProbableRootCauses  []RootCause `json:"probable_root_causes"`
}

// RootCause represents a probable root cause of divergence
type RootCause struct {
	StepIndex int     `json:"step_index"`
	Field     string  `json:"field"`
	Severity  float64 `json:"severity"` // 0-100
}

// ConsensusConfig configuration for consensus simulation
type ConsensusConfig struct {
	NodeCount     int            `json:"node_count"`
	RandomSeeds   []int          `json:"random_seeds"`
	NodeOverrides map[int]NodeConfig `json:"node_overrides"`
}

// NodeConfig configuration for a specific node in consensus
type NodeConfig struct {
	NodeID       string            `json:"node_id"`
	OS           string            `json:"os"`
	Arch         string            `json:"arch"`
	NonCritical  map[string]string `json:"non_critical"` // can be randomized
}

// ConsensusReport represents the result of consensus simulation
type ConsensusReport struct {
	RunID           string          `json:"run_id"`
	NodeCount       int             `json:"node_count"`
	Nodes           []NodeResult    `json:"nodes"`
	AgreementRate   float64         `json:"agreement_rate"` // 0-100
	MajorityProofHash string        `json:"majority_proof_hash"`
	ConsensusScore  int             `json:"consensus_score"` // 0-100
	DivergenceAnalysis DivergenceAnalysis `json:"divergence_analysis"`
	Timestamp       time.Time       `json:"timestamp"`
}

// NodeResult result from a single node in consensus simulation
type NodeResult struct {
	NodeID       string `json:"node_id"`
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	ProofHash    string `json:"proof_hash"`
	StepKeys     []string `json:"step_keys"`
	IsMajority   bool   `json:"is_majority"`
}

// DivergenceAnalysis analysis of divergence in consensus
type DivergenceAnalysis struct {
	TotalNodes       int     `json:"total_nodes"`
	MajorityCount    int     `json:"majority_count"`
	MinorityCount    int     `json:"minority_count"`
	MinorityNodes    []string `json:"minority_nodes"`
	DivergenceTypes  []string `json:"divergence_types"`
}

// ByzantineConfig configuration for byzantine fault simulation
type ByzantineConfig struct {
	RunID            string   `json:"run_id"`
	MutationTypes    []string `json:"mutation_types"` // "step_output", "plugin_output", "dependency_order"
	MutationRate     float64  `json:"mutation_rate"`   // 0-1
	SimulationCount  int      `json:"simulation_count"`
}

// ByzantineReport result of byzantine fault simulation
type ByzantineReport struct {
	RunID             string            `json:"run_id"`
	SimulationCount   int               `json:"simulation_count"`
	MutationsApplied  int               `json:"mutations_applied"`
	Detections        []ByzantineDetection `json:"detections"`
	DetectionRate     float64           `json:"detection_rate"` // 0-100
	FalsePositives    int               `json:"false_positives"`
	Timestamp         time.Time         `json:"timestamp"`
	Status            string            `json:"status"` // "detected", "undetected", "partial"
}

// ByzantineDetection detection of a byzantine fault
type ByzantineDetection struct {
	SimulationID    int      `json:"simulation_id"`
	MutationType   string   `json:"mutation_type"`
	ProofMismatch  bool     `json:"proof_mismatch"`
	ChainInvalidated bool   `json:"chain_invalidated"`
	SignatureInvalid bool   `json:"signature_invalid"`
	DetectionTime  float64  `json:"detection_time_ms"`
}

// PeerTrustReport peer trust index report
type PeerTrustReport struct {
	RunID              string          `json:"run_id"`
	PeerCount          int             `json:"peer_count"`
	DeterminismConfidence int          `json:"determinism_confidence"`
	ConsensusScore     int             `json:"consensus_score"`
	PluginCertificationScore int       `json:"plugin_certification_score"`
	PeerTrustScore     int             `json:"peer_trust_score"` // 0-100
	PeerDetails        []PeerDetail    `json:"peer_details"`
	Timestamp          time.Time       `json:"timestamp"`
}

// PeerDetail details about a single peer
type PeerDetail struct {
	PeerID          string  `json:"peer_id"`
	TrustScore      float64 `json:"trust_score"`
	DeterminismScore int    `json:"determinism_score"`
	ConsensusScore  int     `json:"consensus_score"`
	IsCertified    bool    `json:"is_certified"`
}

// NewVerificationFile creates a new verification file from a run
func NewVerificationFile(runID, engineVersion string, plugins map[string]string, proofHash string, eventLog []map[string]any, steps []string, provenance ProvenanceSnapshot, confidence int) *VerificationFile {
	// Create proof chain
	proofChain := ProofChain{
		Events: make([]string, len(eventLog)),
		Steps:  make([]string, len(steps)),
	}
	
	for i, event := range eventLog {
		proofChain.Events[i] = hashEvent(event)
	}
	copy(proofChain.Steps, steps)
	proofChain.RootProof = proofHash
	
	// Create canonical inputs (hash-only for large data)
	canonicalInputs := make(map[string]string)
	canonicalInputs["event_log_hash"] = HashEvents(eventLog)
	
	return &VerificationFile{
		Meta: VerificationMeta{
			RunID:              runID,
			CreatedAt:          time.Now().UTC(),
			ExporterNodeID:     GetMachineID(),
			FileVersion:        "1.0",
			OriginalProofHash:  proofHash,
		},
		ProofChain:         proofChain,
		CanonicalInputs:    canonicalInputs,
		ProvenanceSnapshot: provenance,
		PluginVersions:    plugins,
		EngineVersion:     engineVersion,
		DeterminismMetadata: DeterminismMetadata{
			ConfidenceScore:    confidence,
			StableSteps:        steps,
			VerificationTrials: 5,
		},
		EnvFingerprint: NewEnvironmentFingerprint(engineVersion, plugins),
	}
}

// NewEnvironmentFingerprint creates a normalized environment fingerprint
func NewEnvironmentFingerprint(engineVersion string, plugins map[string]string) EnvironmentFingerprint {
	return EnvironmentFingerprint{
		OS:             normalizeOS(runtime.GOOS),
		Arch:           normalizeArch(runtime.GOARCH),
		EngineVersion:  engineVersion,
		PluginVersions: plugins,
		NormalizedPaths: []string{}, // No absolute paths
		DeterministicSalt: hashStrings([]string{engineVersion, "deterministic"}),
	}
}

func normalizeOS(os string) string {
	// Map to canonical OS names
	switch strings.ToLower(os) {
	case "darwin", "macos":
		return "macos"
	case "windows", "win32":
		return "windows"
	case "linux", "ubuntu", "debian", "centos", "rhel":
		return "linux"
	default:
		return "unknown"
	}
}

func normalizeArch(arch string) string {
	switch strings.ToLower(arch) {
	case "amd64", "x86_64", "x64":
		return "x64"
	case "386", "i386", "i686", "x86":
		return "x86"
	case "arm64", "aarch64":
		return "arm64"
	case "arm", "armv7":
		return "arm"
	default:
		return "unknown"
	}
}

// HashEvents creates a deterministic hash of events
func HashEvents(events []map[string]any) string {
	h := sha256.New()
	for _, event := range events {
		h.Write([]byte(hashEvent(event)))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func hashEvent(event map[string]any) string {
	// Normalize event for deterministic hashing
	normalized := normalizeEvent(event)
	b, _ := json.Marshal(normalized)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func normalizeEvent(event map[string]any) map[string]any {
	// Strip timestamps, absolute paths, machine identifiers
	result := make(map[string]any)
	for k, v := range event {
		lowerK := strings.ToLower(k)
		// Skip timestamp-related fields
		if strings.Contains(lowerK, "timestamp") || strings.Contains(lowerK, "time") || lowerK == "now" {
			continue
		}
		// Skip absolute paths
		if strings.Contains(k, "/") || strings.Contains(k, "\\") {
			if !strings.HasPrefix(k, ".") {
				continue
			}
		}
		// Skip machine identifiers
		if strings.Contains(lowerK, "machine") || strings.Contains(lowerK, "host") || strings.Contains(lowerK, "uuid") {
			continue
		}
		result[k] = v
	}
	return result
}

// RunPeerVerification performs local re-verification of a verification file
func RunPeerVerification(runID string, vf VerificationFile) (*PeerVerificationReport, error) {
	report := &PeerVerificationReport{
		RunID:                runID,
		VerificationFilePath: "",
		OriginalProofHash:    vf.Meta.OriginalProofHash,
		Timestamp:            time.Now().UTC(),
		Status:               "error",
	}
	
	// Simulate local computation (in production, this would re-run the actual computation)
	// For now, we'll compute a deterministic local hash
	localProofHash := computeLocalProof(runID, vf)
	report.LocalProofHash = localProofHash
	report.ProofMatch = localProofHash == vf.Meta.OriginalProofHash
	
	// Compare step keys
	stepComparison := compareStepKeys(vf.ProofChain.Steps, vf.DeterminismMetadata.StableSteps)
	report.StepKeyComparison = stepComparison
	
	// Compute divergence score
	report.DivergenceScore = computeDivergenceScore(report.ProofMatch, stepComparison)
	
	if report.DivergenceScore > 0 {
		report.Status = "diverged"
		report.DivergenceFingerprint = generateDivergenceFingerprint(stepComparison)
	} else {
		report.Status = "verified"
	}
	
	return report, nil
}

func computeLocalProof(runID string, vf VerificationFile) string {
	// Compute deterministic local proof hash
	data := map[string]any{
		"run_id":       runID,
		"engine":       vf.EngineVersion,
		"plugins":      vf.PluginVersions,
		"events_hash":  vf.CanonicalInputs["event_log_hash"],
	}
	h := sha256.New()
	b, _ := json.Marshal(data)
	h.Write(b)
	return hex.EncodeToString(h.Sum(nil))
}

func compareStepKeys(original, local []string) StepKeyComparison {
	comparison := StepKeyComparison{
		OriginalSteps: original,
		LocalSteps:    local,
		TotalSteps:    len(original),
	}
	
	matching := 0
	for i := range original {
		if i < len(local) && original[i] == local[i] {
			matching++
		} else if i < len(local) {
			comparison.MismatchDetails = append(comparison.MismatchDetails, StepMismatch{
				StepIndex:    i,
				OriginalHash: original[i],
				LocalHash:    local[i],
				Rank:         i + 1, // earlier steps have higher rank as root cause
			})
		}
	}
	comparison.MatchingSteps = matching
	return comparison
}

func computeDivergenceScore(proofMatch bool, stepComparison StepKeyComparison) float64 {
	if proofMatch && stepComparison.MatchingSteps == stepComparison.TotalSteps {
		return 0.0
	}
	
	// Score based on mismatch severity
	proofPenalty := 50.0
	if proofMatch {
		proofPenalty = 0
	}
	
	stepPenalty := 0.0
	if stepComparison.TotalSteps > 0 {
		mismatchRatio := float64(len(stepComparison.MismatchDetails)) / float64(stepComparison.TotalSteps)
		stepPenalty = mismatchRatio * 50.0
	}
	
	return math.Min(100.0, proofPenalty+stepPenalty)
}

func generateDivergenceFingerprint(stepComparison StepKeyComparison) DivergenceFingerprint {
	fingerprint := DivergenceFingerprint{
		DivergentSteps: make([]int, 0),
		ProbableRootCauses: make([]RootCause, 0),
	}
	
	for _, mismatch := range stepComparison.MismatchDetails {
		fingerprint.DivergentSteps = append(fingerprint.DivergentSteps, mismatch.StepIndex)
		if fingerprint.FirstDivergenceStep == 0 || mismatch.StepIndex < fingerprint.FirstDivergenceStep {
			fingerprint.FirstDivergenceStep = mismatch.StepIndex
		}
		
		// Rank root causes
		fingerprint.ProbableRootCauses = append(fingerprint.ProbableRootCauses, RootCause{
			StepIndex: mismatch.StepIndex,
			Field:     "unknown",
			Severity:  100.0 - float64(mismatch.Rank*10),
		})
	}
	
	// Sort by severity
	sort.Slice(fingerprint.ProbableRootCauses, func(i, j int) bool {
		return fingerprint.ProbableRootCauses[i].Severity > fingerprint.ProbableRootCauses[j].Severity
	})
	
	return fingerprint
}

// SimulateConsensus simulates consensus among multiple nodes
func SimulateConsensus(runID string, config ConsensusConfig, baseProofHash string, steps []string) *ConsensusReport {
	report := &ConsensusReport{
		RunID:         runID,
		NodeCount:     config.NodeCount,
		Nodes:         make([]NodeResult, 0),
		AgreementRate: 0,
		Timestamp:     time.Now().UTC(),
	}
	
	// Generate node results
	rand.Seed(time.Now().UnixNano())
	proofHashes := make(map[string]int)
	
	for i := 0; i < config.NodeCount; i++ {
		nodeID := fmt.Sprintf("node-%d", i)
		os := "linux"
		arch := "x64"
		
		// Apply node-specific configuration
		if override, ok := config.NodeOverrides[i]; ok {
			nodeID = override.NodeID
			os = override.OS
			arch = override.Arch
		}
		
		// Simulate proof hash (deterministic for same inputs, varies for different non-critical params)
		proofHash := baseProofHash
		if i > 0 && len(config.RandomSeeds) > 0 {
			// Simulate different non-critical parameters causing minor variations
			seed := config.RandomSeeds[i%len(config.RandomSeeds)]
			proofHash = hashStrings([]string{baseProofHash, fmt.Sprintf("seed-%d", seed), os, arch})
		}
		
		nodeResult := NodeResult{
			NodeID:     nodeID,
			OS:         os,
			Arch:       arch,
			ProofHash:  proofHash,
			StepKeys:   steps,
			IsMajority: false,
		}
		
		report.Nodes = append(report.Nodes, nodeResult)
		proofHashes[proofHash]++
	}
	
	// Find majority
	majorityHash := ""
	majorityCount := 0
	for hash, count := range proofHashes {
		if count > majorityCount {
			majorityHash = hash
			majorityCount = count
		}
	}
	
	// Mark majority nodes
	for i := range report.Nodes {
		if report.Nodes[i].ProofHash == majorityHash {
			report.Nodes[i].IsMajority = true
		}
	}
	
	report.MajorityProofHash = majorityHash
	report.AgreementRate = float64(majorityCount) / float64(config.NodeCount) * 100
	report.ConsensusScore = calculateConsensusScore(report.AgreementRate, config.NodeCount)
	
	// Divergence analysis
	minorityCount := config.NodeCount - majorityCount
	minorityNodes := make([]string, 0)
	for _, node := range report.Nodes {
		if !node.IsMajority {
			minorityNodes = append(minorityNodes, node.NodeID)
		}
	}
	
	report.DivergenceAnalysis = DivergenceAnalysis{
		TotalNodes:      config.NodeCount,
		MajorityCount:   majorityCount,
		MinorityCount:   minorityCount,
		MinorityNodes:   minorityNodes,
		DivergenceTypes: []string{},
	}
	
	if minorityCount > 0 {
		report.DivergenceAnalysis.DivergenceTypes = append(report.DivergenceAnalysis.DivergenceTypes, "parameter_variance")
	}
	
	return report
}

func calculateConsensusScore(agreementRate float64, nodeCount int) int {
	// Base score from agreement rate
	score := int(agreementRate)
	
	// Bonus for more nodes (more robust consensus)
	if nodeCount >= 5 {
		score += 10
	} else if nodeCount >= 3 {
		score += 5
	}
	
	return math.Min(100, score)
}

func hashStrings(strs []string) string {
	h := sha256.New()
	for _, s := range strs {
		h.Write([]byte(s))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// SimulateByzantine simulates byzantine faults and checks detection
func SimulateByzantine(runID string, config ByzantineConfig, baseProofHash string, steps []string) *ByzantineReport {
	report := &ByzantineReport{
		RunID:            runID,
		SimulationCount:  config.SimulationCount,
		MutationsApplied: 0,
		Detections:       make([]ByzantineDetection, 0),
		Timestamp:        time.Now().UTC(),
		Status:           "detected",
	}
	
	rand.Seed(time.Now().UnixNano())
	
	for i := 0; i < config.SimulationCount; i++ {
		simID := i
		
		// Apply mutations based on config
		proofHash := baseProofHash
		chainValid := true
		sigValid := true
		
		for _, mutType := range config.MutationTypes {
			if rand.Float64() < config.MutationRate {
				report.MutationsApplied++
				
				// Mutate based on type
				switch mutType {
				case "step_output":
					proofHash = hashStrings([]string{baseProofHash, fmt.Sprintf("mutated-%d", simID)})
					chainValid = false
				case "plugin_output":
					proofHash = hashStrings([]string{baseProofHash, fmt.Sprintf("plugin-mutated-%d", simID)})
				case "dependency_order":
					proofHash = hashStrings([]string{baseProofHash, fmt.Sprintf("order-mutated-%d", simID)})
					chainValid = false
				}
			}
		}
		
		// Detection: in production, this would verify the proof chain
		detected := (proofHash != baseProofHash) || !chainValid || !sigValid
		
		detection := ByzantineDetection{
			SimulationID:     simID,
			MutationType:     strings.Join(config.MutationTypes, ","),
			ProofMismatch:   proofHash != baseProofHash,
			ChainInvalidated: !chainValid,
			SignatureInvalid: !sigValid,
			DetectionTime:    float64(rand.Intn(100) + 10), // Simulated detection time
		}
		
		report.Detections = append(report.Detections, detection)
		
		if !detected {
			report.Status = "undetected"
		}
	}
	
	// Calculate detection rate
	detectedCount := 0
	for _, d := range report.Detections {
		if d.ProofMismatch || d.ChainInvalidated || d.SignatureInvalid {
			detectedCount++
		}
	}
	
	report.DetectionRate = float64(detectedCount) / float64(report.SimulationCount) * 100
	
	if report.DetectionRate >= 80 {
		report.Status = "detected"
	} else if report.DetectionRate >= 50 {
		report.Status = "partial"
	} else {
		report.Status = "undetected"
	}
	
	return report
}

// ComputePeerTrust computes the peer trust index
func ComputePeerTrust(runID string, determinismConfidence, consensusScore, pluginCertScore int, peers []string) *PeerTrustReport {
	report := &PeerTrustReport{
		RunID:              runID,
		PeerCount:          len(peers),
		DeterminismConfidence: determinismConfidence,
		ConsensusScore:     consensusScore,
		PluginCertificationScore: pluginCertScore,
		PeerDetails:        make([]PeerDetail, 0),
		Timestamp:          time.Now().UTC(),
	}
	
	// Calculate weighted trust score
	// Weights: determinism 40%, consensus 35%, plugin cert 25%
	determinismWeight := 0.4
	consensusWeight := 0.35
	pluginWeight := 0.25
	
	weightedScore := float64(determinismConfidence)*determinismWeight +
		float64(consensusScore)*consensusWeight +
		float64(pluginCertScore)*pluginWeight
	
	report.PeerTrustScore = int(math.Round(weightedScore))
	
	// Generate peer details
	for _, peerID := range peers {
		// Simulate peer-specific scores (in production, these would be real metrics)
		peerDetScore := determinismConfidence - rand.Intn(20)
		peerConsScore := consensusScore - rand.Intn(15)
		
		detail := PeerDetail{
			PeerID:           peerID,
			TrustScore:       float64(peerDetScore+peerConsScore) / 2,
			DeterminismScore: peerDetScore,
			ConsensusScore:   peerConsScore,
			IsCertified:     peerDetScore >= 80,
		}
		
		report.PeerDetails = append(report.PeerDetails, detail)
	}
	
	return report
}

// GetMachineID returns a deterministic machine identifier
func GetMachineID() string {
	// Use only deterministic, reproducible information
	// No actual machine-specific identifiers
	return "reach-deterministic-" + hashStrings([]string{"oss", "v1"})
}
