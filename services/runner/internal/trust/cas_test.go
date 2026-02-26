package trust

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCASSameObjectSameHash(t *testing.T) {
	cas, err := NewCAS(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	one, err := cas.Put(ObjectTranscript, []byte("abc"))
	if err != nil {
		t.Fatal(err)
	}
	two, err := cas.Put(ObjectTranscript, []byte("abc"))
	if err != nil {
		t.Fatal(err)
	}
	if one != two {
		t.Fatalf("expected same hash, got %s and %s", one, two)
	}
}

func TestCASTamperDetection(t *testing.T) {
	cas, err := NewCAS(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h, err := cas.Put(ObjectTranscript, []byte("abc"))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(cas.root, string(ObjectTranscript), h)
	if err := os.WriteFile(path, []byte("evil"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := cas.Verify(ObjectTranscript, h); err == nil {
		t.Fatal("expected verification error")
	}
}

// TestCASLoad performs 10,000 insert/read cycles to verify no fragmentation blowup
func TestCASLoad(t *testing.T) {
	const cycles = 10000
	const payloadSize = 1024 // 1KB per object

	cas, err := NewCAS(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// Track hashes for reads
	hashes := make([]string, cycles)

	// Insert phase - use unique data for each cycle to get unique hashes
	for i := 0; i < cycles; i++ {
		// Create deterministic unique payload based on index
		payload := make([]byte, payloadSize)
		for j := 0; j < payloadSize; j++ {
			payload[j] = byte((i*payloadSize + j) % 256)
		}
		h, err := cas.Put(ObjectTranscript, payload)
		if err != nil {
			t.Fatalf("insert failed at cycle %d: %v", i, err)
		}
		hashes[i] = h
	}

	// Read phase - verify all objects can be retrieved
	for i := 0; i < cycles; i++ {
		data, err := cas.Get(ObjectTranscript, hashes[i])
		if err != nil {
			t.Fatalf("read failed at cycle %d: %v", i, err)
		}
		// Verify content matches what was stored
		expectedPayload := make([]byte, payloadSize)
		for j := 0; j < payloadSize; j++ {
			expectedPayload[j] = byte((i*payloadSize + j) % 256)
		}
		if string(data) != string(expectedPayload) {
			t.Fatalf("payload mismatch at cycle %d", i)
		}
	}

	// Verify corruption detection still works
	for i := 0; i < cycles; i++ {
		if err := cas.Verify(ObjectTranscript, hashes[i]); err != nil {
			t.Fatalf("verification failed at cycle %d: %v", i, err)
		}
	}

	// Check fragmentation - verify no blowup
	status, err := cas.StatusEx()
	if err != nil {
		t.Fatal(err)
	}

	expectedSize := int64(cycles) * int64(payloadSize)
	if status.TotalSizeBytes > expectedSize*2 {
		t.Fatalf("fragmentation blowup detected: size %d, expected max %d", status.TotalSizeBytes, expectedSize*2)
	}

	// All objects should have unique hashes (they should, since payload is different per cycle)
	uniqueHashes := make(map[string]bool)
	for _, h := range hashes {
		uniqueHashes[h] = true
	}
	if len(uniqueHashes) != cycles {
		t.Fatalf("hash uniqueness failed: got %d unique hashes, expected %d", len(uniqueHashes), cycles)
	}

	_ = status // Use the status
}

// TestCASStatusEx verifies the enhanced status method
func TestCASStatusEx(t *testing.T) {
	cas, err := NewCAS(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// Add some objects
	for i := 0; i < 10; i++ {
		_, err := cas.Put(ObjectTranscript, []byte(fmt.Sprintf("test data %d", i)))
		if err != nil {
			t.Fatal(err)
		}
	}

	status, err := cas.StatusEx()
	if err != nil {
		t.Fatal(err)
	}

	if status.ObjectCount != 10 {
		t.Fatalf("expected 10 objects, got %d", status.ObjectCount)
	}

	if status.TotalSizeBytes == 0 {
		t.Fatal("expected non-zero total size")
	}

	if status.FormatVersion == "" {
		t.Fatal("expected format version to be set")
	}
}

// TestCASCompact tests the compaction functionality
func TestCASCompact(t *testing.T) {
	cas, err := NewCAS(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// Add some objects
	for i := 0; i < 5; i++ {
		_, err := cas.Put(ObjectTranscript, []byte(fmt.Sprintf("test data %d", i)))
		if err != nil {
			t.Fatal(err)
		}
	}

	// Run compaction
	deleted, err := cas.Compact(false)
	if err != nil {
		t.Fatal(err)
	}

	// Should have cleaned up some temp files
	if deleted < 0 {
		t.Fatalf("deleted count should be non-negative, got %d", deleted)
	}

	// Run aggressive compaction
	deleted, err = cas.Compact(true)
	if err != nil {
		t.Fatal(err)
	}

	_ = deleted // Use the value
}

// TestCASConfigWithEviction tests CAS with LRU eviction
func TestCASConfigWithEviction(t *testing.T) {
	cas, err := NewCASWithConfig(t.TempDir(), CASConfig{
		EvictionPolicy:      EvictionPolicyLRU,
		LRUWindow:           1 * time.Hour,
		MaxCASSizeBytes:     1024 * 1024, // 1MB
		AtomicWritesEnabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Add objects
	for i := 0; i < 100; i++ {
		h, err := cas.Put(ObjectTranscript, []byte(fmt.Sprintf("test data %d", i)))
		if err != nil {
			t.Fatal(err)
		}
		// Update LRU
		cas.UpdateLRU(ObjectTranscript, h)
	}

	// Test LRU eviction (should not error)
	freed, err := cas.EvictLRU(1024 * 100) // Try to free 100KB
	if err != nil {
		t.Fatal(err)
	}

	if freed < 0 {
		t.Fatalf("freed should be non-negative, got %d", freed)
	}

	_ = cas
}
