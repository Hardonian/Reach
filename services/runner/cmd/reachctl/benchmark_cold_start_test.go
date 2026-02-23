// Copyright 2025 Reach Core Contributors
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"runtime"
	"runtime/debug"
	"testing"
	"time"
)

// ColdStartMetrics captures startup performance data
type ColdStartMetrics struct {
	BinarySizeMB      float64 `json:"binary_size_mb"`
	StartupTimeMs     int64   `json:"startup_time_ms"`
	AllocBytes        uint64  `json:"alloc_bytes"`
	TotalAllocBytes   uint64  `json:"total_alloc_bytes"`
	SysBytes          uint64  `json:"sys_bytes"`
	NumGC             uint32  `json:"num_gc"`
	HeapObjects       uint64  `json:"heap_objects"`
	Goroutines        int     `json:"goroutines"`
	Timestamp         string  `json:"timestamp"`
	GoVersion         string  `json:"go_version"`
}

// BenchmarkColdStart measures CLI startup latency and memory allocations
func BenchmarkColdStart(b *testing.B) {
	for i := 0; i < b.N; i++ {
		// Force GC to get clean memory stats
		runtime.GC()
		debug.FreeOSMemory()

		var m1 runtime.MemStats
		runtime.ReadMemStats(&m1)

		start := time.Now()

		// Simulate minimal CLI invocation with "version" command
		var out bytes.Buffer
		var errOut bytes.Buffer
		ctx := context.Background()

		// Run the version command (lightweight)
		exitCode := run(ctx, []string{"version"}, &out, &errOut)

		elapsed := time.Since(start)

		var m2 runtime.MemStats
		runtime.ReadMemStats(&m2)

		if exitCode != 0 {
			b.Fatalf("version command failed with exit code %d", exitCode)
		}

		b.ReportMetric(float64(elapsed.Milliseconds()), "startup_ms")
		b.ReportMetric(float64(m2.TotalAlloc-m1.TotalAlloc), "alloc_bytes")
		b.ReportMetric(float64(m2.HeapObjects-m1.HeapObjects), "heap_objects")
	}
}

// BenchmarkColdStartHelp measures startup for help command
func BenchmarkColdStartHelp(b *testing.B) {
	for i := 0; i < b.N; i++ {
		runtime.GC()

		start := time.Now()

		var out bytes.Buffer
		var errOut bytes.Buffer
		ctx := context.Background()

		exitCode := run(ctx, []string{"help"}, &out, &errOut)

		elapsed := time.Since(start)

		if exitCode != 0 && exitCode != 1 { // help returns 1 in some implementations
			b.Fatalf("help command failed with exit code %d", exitCode)
		}

		b.ReportMetric(float64(elapsed.Milliseconds()), "startup_ms")
	}
}

// MeasureColdStart performs a single detailed cold start measurement
func MeasureColdStart(command string) (*ColdStartMetrics, error) {
	// Force clean state
	runtime.GC()
	debug.FreeOSMemory()

	var m1 runtime.MemStats
	runtime.ReadMemStats(&m1)

	start := time.Now()

	var out bytes.Buffer
	var errOut bytes.Buffer
	ctx := context.Background()

	exitCode := run(ctx, []string{command}, &out, &errOut)

	elapsed := time.Since(start)

	var m2 runtime.MemStats
	runtime.ReadMemStats(&m2)

	if exitCode != 0 && command != "help" {
		return nil, fmt.Errorf("command failed with exit code %d, stderr: %s", exitCode, errOut.String())
	}

	// Get binary size
	binarySize := int64(0)
	if exe, err := os.Executable(); err == nil {
		if info, err := os.Stat(exe); err == nil {
			binarySize = info.Size()
		}
	}

	return &ColdStartMetrics{
		BinarySizeMB:    float64(binarySize) / (1024 * 1024),
		StartupTimeMs:   elapsed.Milliseconds(),
		AllocBytes:      m2.TotalAlloc - m1.TotalAlloc,
		TotalAllocBytes: m2.TotalAlloc,
		SysBytes:        m2.Sys,
		NumGC:           m2.NumGC - m1.NumGC,
		HeapObjects:     m2.HeapObjects,
		Goroutines:      runtime.NumGoroutine(),
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
		GoVersion:       runtime.Version(),
	}, nil
}

// PrintColdStartReport prints a formatted cold start report
func PrintColdStartReport(metrics *ColdStartMetrics) {
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           Reach Cold Start Performance Report                ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Printf("Timestamp:    %s\n", metrics.Timestamp)
	fmt.Printf("Go Version:   %s\n", metrics.GoVersion)
	fmt.Println()
	fmt.Println("Binary Size:")
	fmt.Printf("  Size:       %.2f MB\n", metrics.BinarySizeMB)
	fmt.Println()
	fmt.Println("Startup Performance:")
	fmt.Printf("  Time:       %d ms\n", metrics.StartupTimeMs)
	fmt.Printf("  Goroutines: %d\n", metrics.Goroutines)
	fmt.Println()
	fmt.Println("Memory Allocations:")
	fmt.Printf("  Allocated:  %d bytes (%.2f KB)\n", metrics.AllocBytes, float64(metrics.AllocBytes)/1024)
	fmt.Printf("  TotalAlloc: %d bytes (%.2f MB)\n", metrics.TotalAllocBytes, float64(metrics.TotalAllocBytes)/(1024*1024))
	fmt.Printf("  Sys Memory: %d bytes (%.2f MB)\n", metrics.SysBytes, float64(metrics.SysBytes)/(1024*1024))
	fmt.Printf("  HeapObjs:   %d\n", metrics.HeapObjects)
	fmt.Printf("  GC Runs:    %d\n", metrics.NumGC)
	fmt.Println()
}
