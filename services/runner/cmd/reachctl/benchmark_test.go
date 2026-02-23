package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// BenchmarkCapsuleReplay benchmarks replaying a capsule for validation
func BenchmarkCapsuleReplay(b *testing.B) {
	tmpDir := b.TempDir()
	ctx := context.Background()

	// Create a sample capsule with varying event log sizes
	sizes := []int{10, 100, 1000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("events_%d", size), func(b *testing.B) {
			// Create capsule with specified number of events
			cap := createBenchmarkCapsule(size)
			capsulePath := filepath.Join(tmpDir, fmt.Sprintf("bench-%d.capsule.json", size))
			data, _ := json.Marshal(cap)
			os.WriteFile(capsulePath, data, 0644)

			var out bytes.Buffer
			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				out.Reset()
				code := runCapsule(ctx, tmpDir, []string{"replay", capsulePath}, &out, &out)
				if code != 0 {
					b.Fatalf("replay failed with code %d", code)
				}
			}
		})
	}
}

// BenchmarkCapsuleVerify benchmarks capsule integrity verification
func BenchmarkCapsuleVerify(b *testing.B) {
	tmpDir := b.TempDir()
	ctx := context.Background()

	// Create capsule
	cap := createBenchmarkCapsule(100)
	capsulePath := filepath.Join(tmpDir, "verify-bench.capsule.json")
	data, _ := json.Marshal(cap)
	os.WriteFile(capsulePath, data, 0644)

	var out bytes.Buffer
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		out.Reset()
		code := runCapsule(ctx, tmpDir, []string{"verify", capsulePath}, &out, &out)
		if code != 0 {
			b.Fatalf("verify failed with code %d", code)
		}
	}
}

// BenchmarkExportCreation benchmarks creating export capsules
func BenchmarkExportCreation(b *testing.B) {
	tmpDir := b.TempDir()

	// Create run records directory
	runsDir := filepath.Join(tmpDir, "runs")
	os.MkdirAll(runsDir, 0755)

	// Create sample run records of varying sizes
	sizes := []int{10, 100, 1000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("events_%d", size), func(b *testing.B) {
			// Create run record
			record := createBenchmarkRunRecord(size)
			runPath := filepath.Join(runsDir, record.RunID+".json")
			data, _ := json.Marshal(record)
			os.WriteFile(runPath, data, 0644)

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				// Build capsule from record
				_ = buildCapsule(record)
			}
		})
	}
}

// BenchmarkTranscriptLoad benchmarks loading run records (transcripts)
func BenchmarkTranscriptLoad(b *testing.B) {
	tmpDir := b.TempDir()
	runsDir := filepath.Join(tmpDir, "runs")
	os.MkdirAll(runsDir, 0755)

	// Create run records of varying sizes
	sizes := []int{10, 100, 1000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("events_%d", size), func(b *testing.B) {
			// Create and save run record
			record := createBenchmarkRunRecord(size)
			runPath := filepath.Join(runsDir, record.RunID+".json")
			data, _ := json.Marshal(record)
			os.WriteFile(runPath, data, 0644)

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				_, err := loadRunRecord(tmpDir, record.RunID)
				if err != nil {
					b.Fatalf("failed to load run record: %v", err)
				}
			}
		})
	}
}

// BenchmarkStableHash benchmarks the deterministic hashing function
func BenchmarkStableHash(b *testing.B) {
	// Create test data of varying sizes
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("bytes_%d", size), func(b *testing.B) {
			data := make([]byte, size)
			for i := range data {
				data[i] = byte(i % 256)
			}
			testMap := map[string]any{"data": data}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				_ = stableHash(testMap)
			}
		})
	}
}

// BenchmarkDeterministicJSON benchmarks JSON serialization
func BenchmarkDeterministicJSON(b *testing.B) {
	// Create test data
	data := map[string]any{
		"name":   "test",
		"events": make([]map[string]any, 100),
	}
	for i := 0; i < 100; i++ {
		data["events"].([]map[string]any)[i] = map[string]any{
			"step":      i,
			"timestamp": time.Now().UnixNano(),
			"action":    fmt.Sprintf("action_%d", i),
		}
	}

	tmpDir := b.TempDir()
	testFile := filepath.Join(tmpDir, "bench.json")

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = writeDeterministicJSON(testFile, data)
	}
}

// Helper functions

func createBenchmarkCapsule(eventCount int) capsuleFile {
	events := make([]map[string]any, eventCount)
	for i := 0; i < eventCount; i++ {
		events[i] = map[string]any{
			"step":      i,
			"action":    fmt.Sprintf("action_%d", i),
			"timestamp": time.Now().UnixNano() + int64(i),
			"data":      map[string]any{"key": fmt.Sprintf("value_%d", i)},
		}
	}

	return capsuleFile{
		Manifest: capsuleManifest{
			SpecVersion:          "1.0",
			RunID:                fmt.Sprintf("bench-%d", time.Now().UnixNano()),
			RunFingerprint:       "benchmark-fingerprint",
			RegistrySnapshotHash: "benchmark-snapshot",
			Pack:                 map[string]any{"name": "benchmark-pack"},
			Policy:               map[string]any{"decision": "allow"},
			Environment:          map[string]string{"benchmark": "true"},
			CreatedAt:            time.Now().UTC().Format(time.RFC3339),
		},
		EventLog: events,
	}
}

func createBenchmarkRunRecord(eventCount int) runRecord {
	events := make([]map[string]any, eventCount)
	for i := 0; i < eventCount; i++ {
		events[i] = map[string]any{
			"step":      i,
			"action":    fmt.Sprintf("action_%d", i),
			"timestamp": time.Now().UnixNano() + int64(i),
		}
	}

	return runRecord{
		RunID:                fmt.Sprintf("bench-run-%d", time.Now().UnixNano()),
		Pack:                 map[string]any{"name": "benchmark-pack"},
		Policy:               map[string]any{"decision": "allow"},
		RegistrySnapshotHash: "benchmark-snapshot",
		EventLog:             events,
		Latency:              float64(eventCount * 10),
		TokenUsage:           eventCount * 100,
		FederationPath:       []string{},
		TrustScores:          map[string]float64{"local": 100.0},
		AuditChain:           []string{"benchmark"},
		Environment:          map[string]string{"benchmark": "true"},
	}
}

// BenchmarkWizardQuickMode benchmarks the wizard quick mode
func BenchmarkWizardQuickMode(b *testing.B) {
	tmpDir := b.TempDir()

	// Setup minimal registry
	registryDir := filepath.Join(tmpDir, "registry")
	os.MkdirAll(registryDir, 0755)
	registry := map[string]any{
		"packs": []map[string]any{
			{"name": "bench.pack", "spec_version": "1.0", "verified": true},
		},
	}
	data, _ := json.Marshal(registry)
	os.WriteFile(filepath.Join(registryDir, "index.json"), data, 0644)

	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		wizard := NewWizard(tmpDir, &bytes.Buffer{}, &bytes.Buffer{}, true, true)
		_ = wizard.Run(ctx)
	}
}

// BenchmarkOperatorMetrics benchmarks calculating operator metrics
func BenchmarkOperatorMetrics(b *testing.B) {
	tmpDir := b.TempDir()
	runsDir := filepath.Join(tmpDir, "runs")
	os.MkdirAll(runsDir, 0755)

	// Create 100 run records
	for i := 0; i < 100; i++ {
		record := runRecord{
			RunID:    fmt.Sprintf("run-%d", i),
			Policy:   map[string]any{"decision": "allow"},
			EventLog: []map[string]any{{"step": 1}},
		}
		data, _ := json.Marshal(record)
		os.WriteFile(filepath.Join(runsDir, fmt.Sprintf("run-%d.json", i)), data, 0644)
	}

	nodes := []struct{}{}
	_ = nodes

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// We can't directly call this without the federation type
		// This is a placeholder for the actual benchmark
		// calculateOperatorMetrics(tmpDir, nil)
	}
}
