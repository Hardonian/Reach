package determinism

import (
	"testing"
)

func TestHashDeterminism(t *testing.T) {
	// Same input should produce same hash
	input := map[string]any{"a": 1, "b": "test", "c": []any{1, 2, 3}}
	hash1 := Hash(input)
	hash2 := Hash(input)

	if hash1 != hash2 {
		t.Errorf("Hash not deterministic: %s vs %s", hash1, hash2)
	}
}

func TestHashMapKeyOrderIndependence(t *testing.T) {
	// Different key order should produce same hash after canonicalization
	input1 := map[string]any{"z": 1, "a": 2, "m": 3}
	input2 := map[string]any{"a": 2, "m": 3, "z": 1}

	hash1 := Hash(input1)
	hash2 := Hash(input2)

	if hash1 != hash2 {
		t.Errorf("Hash should be independent of map key order: %s vs %s", hash1, hash2)
	}
}

func TestHashNestedStructures(t *testing.T) {
	input := map[string]any{
		"level1": map[string]any{
			"level2": map[string]any{
				"value": "deep",
			},
		},
		"array": []any{1, 2, map[string]any{"b": 2, "a": 1}},
	}

	hash1 := Hash(input)
	hash2 := Hash(input)

	if hash1 != hash2 {
		t.Errorf("Nested structure hash not deterministic: %s vs %s", hash1, hash2)
	}
}

func TestCanonicalJSONSorting(t *testing.T) {
	input := map[string]any{"z": 1, "a": 2, "m": 3}
	canon := CanonicalJSON(input)

	// Canonical JSON should have sorted keys: a, m, z
	expected := `{"a":2,"m":3,"z":1}`
	if canon != expected {
		t.Errorf("Canonical JSON not sorted: got %s, want %s", canon, expected)
	}
}

func TestHashEventLog(t *testing.T) {
	eventLog := []map[string]any{
		{"step": "start", "timestamp": "2024-01-01T00:00:00Z"},
		{"step": "tool_call", "tool": "echo"},
		{"step": "end"},
	}
	runID := "run-123"

	hash1 := HashEventLog(eventLog, runID)
	hash2 := HashEventLog(eventLog, runID)

	if hash1 != hash2 {
		t.Errorf("Event log hash not deterministic: %s vs %s", hash1, hash2)
	}
}

func TestVerifyReplay(t *testing.T) {
	eventLog := []map[string]any{
		{"step": "start"},
		{"step": "end"},
	}
	runID := "run-456"

	fingerprint := HashEventLog(eventLog, runID)

	if !VerifyReplay(eventLog, runID, fingerprint) {
		t.Error("VerifyReplay should return true for matching fingerprint")
	}

	if VerifyReplay(eventLog, runID, "tampered-hash") {
		t.Error("VerifyReplay should return false for mismatched fingerprint")
	}
}

func TestVerifyReplayDifferentEventLog(t *testing.T) {
	eventLog1 := []map[string]any{{"step": "start"}}
	eventLog2 := []map[string]any{{"step": "start"}, {"step": "end"}}
	runID := "run-789"

	fingerprint1 := HashEventLog(eventLog1, runID)

	if VerifyReplay(eventLog2, runID, fingerprint1) {
		t.Error("VerifyReplay should return false for different event log")
	}
}

// BenchmarkHash measures the performance of the Hash function
func BenchmarkHash(b *testing.B) {
	input := map[string]any{
		"event_log": []map[string]any{
			{"step": "start", "data": "initial"},
			{"step": "process", "data": "working"},
			{"step": "end", "data": "final"},
		},
		"run_id": "benchmark-run",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Hash(input)
	}
}
