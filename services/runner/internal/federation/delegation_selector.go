package federation

import (
	"errors"
	"sort"
)

type Candidate struct {
	NodeID               string
	Capabilities         []string
	SpecVersion          string
	RegistrySnapshotHash string
	LatencyMS            int
	EconomicWeight       int
	Quarantined          bool
	TrustScore           int
}

type SelectorConfig struct {
	EnableWeightedSelection bool
	EconomicWeightFactor    int
	RequiredCapabilities    []string
	SpecVersion             string
	RegistrySnapshotHash    string
}

func SelectCandidate(cfg SelectorConfig, candidates []Candidate) (Candidate, error) {
	eligible := make([]Candidate, 0, len(candidates))
	for _, c := range candidates {
		if c.Quarantined || c.SpecVersion != cfg.SpecVersion || c.RegistrySnapshotHash != cfg.RegistrySnapshotHash {
			continue
		}
		if !supportsAll(c.Capabilities, cfg.RequiredCapabilities) {
			continue
		}
		eligible = append(eligible, c)
	}
	if len(eligible) == 0 {
		return Candidate{}, errors.New("no eligible delegation candidate")
	}
	if !cfg.EnableWeightedSelection {
		sort.SliceStable(eligible, func(i, j int) bool { return eligible[i].NodeID < eligible[j].NodeID })
		return eligible[0], nil
	}
	factor := cfg.EconomicWeightFactor
	if factor < 0 {
		factor = 0
	}
	sort.SliceStable(eligible, func(i, j int) bool {
		si := score(eligible[i], factor)
		sj := score(eligible[j], factor)
		if si == sj {
			return eligible[i].NodeID < eligible[j].NodeID
		}
		return si > sj
	})
	return eligible[0], nil
}

func score(c Candidate, econFactor int) int {
	latencyBoost := 0
	if c.LatencyMS > 0 {
		latencyBoost = 1000 / c.LatencyMS
	}
	return c.TrustScore*10 + latencyBoost + c.EconomicWeight*econFactor
}

func supportsAll(provided, required []string) bool {
	lookup := map[string]struct{}{}
	for _, p := range provided {
		lookup[p] = struct{}{}
	}
	for _, r := range required {
		if _, ok := lookup[r]; !ok {
			return false
		}
	}
	return true
}

func ShouldQuarantine(score int, replayMismatch bool, threshold int) bool {
	if replayMismatch {
		return true
	}
	return score < threshold
}
