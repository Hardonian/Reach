package federation

import "math"

// TrustScoreWeights defines the weight distribution for trust score components.
// Weights must sum to 1.0.
var TrustScoreWeights = struct {
	SuccessRate float64
	Latency     float64
	Policy      float64
	Spec        float64
	Replay      float64
}{
	SuccessRate: 0.45,
	Latency:     0.20,
	Policy:      0.15,
	Spec:        0.10,
	Replay:      0.10,
}

// MinDelegationsForFullConfidence is the minimum number of delegations
// required before the trust score reaches full confidence. Below this
// threshold, the score is blended with a neutral prior of 50.
const MinDelegationsForFullConfidence = 20

// Score formula (0-100, deterministic):
// 45% success rate + 20% latency quality + 15% policy compliance + 10% spec/registry alignment + 10% replay consistency.
// For nodes with few observations, the score is blended toward a neutral prior (50)
// to avoid overconfidence from small sample sizes.
func TrustScore(s ReputationSnapshot) int {
	total := s.DelegationsSucceeded
	for _, v := range s.DelegationsFailedByReason {
		total += v
	}
	successRate := 1.0
	if total > 0 {
		successRate = float64(s.DelegationsSucceeded) / float64(total)
	}
	latencyQuality := clamp01((500.0-float64(s.Latency.P50MS))/500.0)*0.6 + clamp01((1200.0-float64(s.Latency.P95MS))/1200.0)*0.4
	policyQuality := 1.0 - boundedPenalty(float64(s.PolicyDenials), 10)
	specQuality := 1.0 - boundedPenalty(float64(s.SpecMismatchIncidents+s.RegistryMismatchIncidents), 4)
	replayQuality := 1.0 - boundedPenalty(float64(s.ReplayMismatchIncidents), 2)

	rawScore := 100.0 * (TrustScoreWeights.SuccessRate*successRate +
		TrustScoreWeights.Latency*latencyQuality +
		TrustScoreWeights.Policy*policyQuality +
		TrustScoreWeights.Spec*specQuality +
		TrustScoreWeights.Replay*replayQuality)

	// Confidence blending: blend toward neutral prior when sample count is low
	confidence := clamp01(float64(total) / float64(MinDelegationsForFullConfidence))
	neutralPrior := 50.0
	score := confidence*rawScore + (1-confidence)*neutralPrior

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return int(math.Round(score))
}

func boundedPenalty(v float64, maxBeforeCap float64) float64 {
	if v <= 0 {
		return 0
	}
	p := v / maxBeforeCap
	if p > 1 {
		p = 1
	}
	return p
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
