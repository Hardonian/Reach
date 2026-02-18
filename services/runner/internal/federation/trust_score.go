package federation

import "math"

// Score formula (0-100, deterministic):
// 45% success rate + 20% latency quality + 15% policy compliance + 10% spec/registry alignment + 10% replay consistency.
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

	score := 100.0 * (0.45*successRate + 0.20*latencyQuality + 0.15*policyQuality + 0.10*specQuality + 0.10*replayQuality)
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
