package api

import (
	"sync"
	"testing"
)

func TestNewNodeRegistry(t *testing.T) {
	r := NewNodeRegistry()
	if r == nil {
		t.Fatal("NewNodeRegistry returned nil")
	}
	if r.nodes == nil {
		t.Error("NewNodeRegistry did not initialize nodes map")
	}
}

func TestSupportsAll(t *testing.T) {
	testCases := []struct {
		name     string
		provided []string
		required []string
		expected bool
	}{
		{"all match", []string{"a", "b", "c"}, []string{"a", "b"}, true},
		{"some match", []string{"a", "b"}, []string{"a", "c"}, false},
		{"none match", []string{"a"}, []string{"b"}, false},
		{"empty required", []string{"a", "b"}, []string{}, true},
		{"empty provided", []string{}, []string{"a"}, false},
		{"both empty", []string{}, []string{}, true},
		{"exact match", []string{"a", "b"}, []string{"a", "b"}, true},
		{"more required", []string{"a", "b"}, []string{"a", "b", "c"}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := supportsAll(tc.provided, tc.required); got != tc.expected {
				t.Errorf("supportsAll(%v, %v) = %v; want %v", tc.provided, tc.required, got, tc.expected)
			}
		})
	}
}

func TestUpdateReputation(t *testing.T) {
	r := NewNodeRegistry()
	nodeID := "node-1"
	r.nodes[nodeID] = nodeInfo{reliabilityScore: 0.5}

	r.UpdateReputation(nodeID, true) // Drifted
	if r.nodes[nodeID].reliabilityScore > 0.4 || r.nodes[nodeID].reliabilityScore < 0.399 {
		t.Errorf("Expected reliability to decrease. Got %f", r.nodes[nodeID].reliabilityScore)
	}

	r.UpdateReputation(nodeID, false) // Not drifted
	if r.nodes[nodeID].reliabilityScore < 0.4 {
		t.Errorf("Expected reliability to increase. Got %f", r.nodes[nodeID].reliabilityScore)
	}
}

func TestGetReliability(t *testing.T) {
	r := NewNodeRegistry()
	nodeID := "node-1"
	expectedScore := 0.8
	r.nodes[nodeID] = nodeInfo{reliabilityScore: expectedScore}

	if score := r.GetReliability(nodeID); score != expectedScore {
		t.Errorf("GetReliability() = %f; want %f", score, expectedScore)
	}
}

func TestGetReliability_UnknownNode(t *testing.T) {
	r := NewNodeRegistry()
	if score := r.GetReliability("unknown-node"); score != 0.5 {
		t.Errorf("GetReliability() for unknown node = %f; want 0.5", score)
	}
}

func TestUpdateReputation_Boundaries(t *testing.T) {
	r := NewNodeRegistry()
	nodeID := "node-1"

	// Test lower bound
	r.nodes[nodeID] = nodeInfo{reliabilityScore: 0.0}
	r.UpdateReputation(nodeID, true) // Drift
	if r.nodes[nodeID].reliabilityScore != 0.0 {
		t.Errorf("Reliability score should not go below 0.0. Got %f", r.nodes[nodeID].reliabilityScore)
	}

	// Test upper bound
	r.nodes[nodeID] = nodeInfo{reliabilityScore: 1.0}
	r.UpdateReputation(nodeID, false) // No drift
	if r.nodes[nodeID].reliabilityScore != 1.0 {
		t.Errorf("Reliability score should not go above 1.0. Got %f", r.nodes[nodeID].reliabilityScore)
	}
}

func TestUpdateReputation_Concurrency(t *testing.T) {
	r := NewNodeRegistry()
	nodeID := "node-1"
	r.nodes[nodeID] = nodeInfo{reliabilityScore: 0.5}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(drift bool) {
			defer wg.Done()
			r.UpdateReputation(nodeID, drift)
		}(i%2 == 0) // Alternate between drifted and not drifted
	}
	wg.Wait()

	// The final score is not deterministic, but we can check if it's within a reasonable range.
	// The test mainly ensures there are no race conditions.
	score := r.GetReliability(nodeID)
	if score < 0.0 || score > 1.0 {
		t.Errorf("Reliability score is out of bounds after concurrent updates: %f", score)
	}
}
