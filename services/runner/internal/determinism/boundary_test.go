package determinism

import (
	"testing"
	"time"
)

// TestEntropyCheck_WallClockTime verifies that time.Time is rejected.
func TestEntropyCheck_WallClockTime(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	err := da.EntropyCheck(time.Now(), "test")
	if err == nil {
		t.Error("Expected error for time.Time, got nil")
	}

	// Pointer to time should also fail
	now := time.Now()
	err = da.EntropyCheck(&now, "test")
	if err == nil {
		t.Error("Expected error for *time.Time, got nil")
	}
}

// TestEntropyCheck_NilTime passes for nil time pointer.
func TestEntropyCheck_NilTime(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	var nilTime *time.Time
	err := da.EntropyCheck(nilTime, "test")
	if err != nil {
		t.Errorf("Expected no error for nil *time.Time, got: %v", err)
	}
}

// TestEntropyCheck_FloatingPoint verifies that floats are rejected.
func TestEntropyCheck_FloatingPoint(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	err := da.EntropyCheck(3.14, "test")
	if err == nil {
		t.Error("Expected error for float64, got nil")
	}

	err = da.EntropyCheck(float32(3.14), "test")
	if err == nil {
		t.Error("Expected error for float32, got nil")
	}
}

// TestEntropyCheck_UnsortedMap verifies that unsorted maps are detected.
func TestEntropyCheck_UnsortedMap(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	// Map with unsorted keys (z before a)
	unsorted := map[string]any{
		"z": 1,
		"a": 2,
	}

	err := da.EntropyCheck(unsorted, "test")
	if err == nil {
		t.Error("Expected error for unsorted map keys, got nil")
	}
}

// TestEntropyCheck_SortedMap passes for sorted maps.
func TestEntropyCheck_SortedMap(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	// Map with sorted keys
	sorted := map[string]any{
		"a": 1,
		"b": 2,
		"c": 3,
	}

	err := da.EntropyCheck(sorted, "test")
	if err != nil {
		t.Errorf("Expected no error for sorted map, got: %v", err)
	}
}

// TestEntropyCheck_StructWithTime verifies struct field detection.
func TestEntropyCheck_StructWithTime(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	type BadStruct struct {
		Name      string
		Timestamp time.Time
	}

	s := BadStruct{Name: "test", Timestamp: time.Now()}
	err := da.EntropyCheck(s, "test")
	if err == nil {
		t.Error("Expected error for struct with time.Time field, got nil")
	}
}

// TestEntropyCheck_StructWithFloat verifies struct float detection.
func TestEntropyCheck_StructWithFloat(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	type BadStruct struct {
		Name  string
		Value float64
	}

	s := BadStruct{Name: "test", Value: 3.14}
	err := da.EntropyCheck(s, "test")
	if err == nil {
		t.Error("Expected error for struct with float64 field, got nil")
	}
}

// TestEntropyCheck_GoodStruct passes for valid structs.
func TestEntropyCheck_GoodStruct(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	type GoodStruct struct {
		Name  string
		Count int
		Tags  []string
	}

	s := GoodStruct{Name: "test", Count: 42, Tags: []string{"a", "b"}}
	err := da.EntropyCheck(s, "test")
	if err != nil {
		t.Errorf("Expected no error for good struct, got: %v", err)
	}
}

// TestComputeFingerprint_Determinism verifies fingerprint is deterministic.
func TestComputeFingerprint_Determinism(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	fp1 := da.ComputeFingerprint("run-123", "event-hash-abc")
	fp2 := da.ComputeFingerprint("run-123", "event-hash-abc")

	if fp1 != fp2 {
		t.Errorf("Fingerprint not deterministic: %s vs %s", fp1, fp2)
	}
}

// TestComputeFingerprint_DifferentInputs produces different fingerprints.
func TestComputeFingerprint_DifferentInputs(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	fp1 := da.ComputeFingerprint("run-123", "event-hash-abc")
	fp2 := da.ComputeFingerprint("run-123", "event-hash-def")
	fp3 := da.ComputeFingerprint("run-456", "event-hash-abc")

	if fp1 == fp2 {
		t.Error("Different event hashes should produce different fingerprints")
	}

	if fp1 == fp3 {
		t.Error("Different run IDs should produce different fingerprints")
	}
}

// TestComputeRunID_Determinism verifies run ID is content-addressed.
func TestComputeRunID_Determinism(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	runID1 := da.ComputeRunID("pack-abc", "input-xyz", 1)
	runID2 := da.ComputeRunID("pack-abc", "input-xyz", 1)

	if runID1 != runID2 {
		t.Errorf("Run ID not deterministic: %s vs %s", runID1, runID2)
	}
}

// TestComputeRunID_DifferentInputs produces different run IDs.
func TestComputeRunID_DifferentInputs(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	runID1 := da.ComputeRunID("pack-abc", "input-xyz", 1)
	runID2 := da.ComputeRunID("pack-abc", "input-xyz", 2)
	runID3 := da.ComputeRunID("pack-def", "input-xyz", 1)

	if runID1 == runID2 {
		t.Error("Different sequence should produce different run ID")
	}

	if runID1 == runID3 {
		t.Error("Different pack hash should produce different run ID")
	}
}

// TestIsolationProof verifies isolation claims.
func TestIsolationProof(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	proof := da.VerifyIsolation()

	if !proof.TransportIsolated {
		t.Error("Transport should be isolated")
	}

	if !proof.LoggingIsolated {
		t.Error("Logging should be isolated")
	}

	if !proof.MetricsIsolated {
		t.Error("Metrics should be isolated")
	}
}

// TestGlobalAuthority_PanicsIfNotInitialized verifies panic on uninitialized access.
func TestGlobalAuthority_PanicsIfNotInitialized(t *testing.T) {
	// Save and restore global state
	old := globalAuthority
	globalAuthority = nil
	defer func() { globalAuthority = old }()

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic for uninitialized global authority")
		}
	}()

	GlobalAuthority()
}

// TestInitGlobalAuthority_PanicsIfCalledTwice verifies double-init panic.
func TestInitGlobalAuthority_PanicsIfCalledTwice(t *testing.T) {
	// Save and restore global state
	old := globalAuthority
	globalAuthority = nil
	defer func() { globalAuthority = old }()

	InitGlobalAuthority("1.0.0")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic for double initialization")
		}
	}()

	InitGlobalAuthority("1.0.0")
}

// TestDigestContext_WithLabels verifies context hashing with labels.
func TestDigestContext_WithLabels(t *testing.T) {
	da := NewDigestAuthority("1.0.0")

	ctx1 := da.NewContext(map[string]string{"env": "prod"})
	ctx2 := da.NewContext(map[string]string{"env": "dev"})
	ctx3 := da.NewContext(nil)

	data := map[string]any{"key": "value"}

	hash1 := ctx1.Hash(data)
	hash2 := ctx2.Hash(data)
	hash3 := ctx3.Hash(data)

	if hash1 == hash2 {
		t.Error("Different labels should produce different hashes")
	}

	if hash1 == hash3 {
		t.Error("Labeled vs unlabeled should produce different hashes")
	}
}

// BenchmarkHash measures the performance of the Hash function.
func BenchmarkHash(b *testing.B) {
	data := map[string]any{
		"run_id":         "abc123",
		"engine_version": "1.0.0",
		"event_log_hash": "def456",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Hash(data)
	}
}

// BenchmarkHashLarge measures performance with large data.
func BenchmarkHashLarge(b *testing.B) {
	events := make([]map[string]any, 100)
	for i := 0; i < 100; i++ {
		events[i] = map[string]any{
			"type":    "tool_call",
			"step_id": i,
			"tool":    "example_tool",
		}
	}

	data := map[string]any{
		"run_id": "abc123",
		"events": events,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Hash(data)
	}
}
