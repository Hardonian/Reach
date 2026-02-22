package determinism

import (
	"testing"
)

func TestDiffRuns(t *testing.T) {
	runA := map[string]any{
		"run_id": "A",
		"pack":   map[string]any{"x": 1},
		"policy": map[string]any{"y": 2},
		"event_log": []any{
			map[string]any{"step": 1, "status": "ok"},
		},
		"registry_snapshot_hash": "hash1",
		"environment":            map[string]string{"env": "prod"},
	}

	runB := map[string]any{
		"run_id": "B",
		"pack":   map[string]any{"x": 1},
		"policy": map[string]any{"y": 2},
		"event_log": []any{
			map[string]any{"step": 1, "status": "error"},
		},
		"registry_snapshot_hash": "hash1",
		"environment":            map[string]string{"env": "dev"},
	}

	diff := DiffRuns(runA, runB)
	if !diff.MismatchFound {
		t.Fatal("Expected mismatch to be found")
	}

	if diff.InputMatch != true {
		t.Error("Input should match")
	}
	if diff.OutputMatch != false {
		t.Error("Output should not match")
	}

	foundEnv := false
	foundStatus := false
	for _, f := range diff.Fields {
		if f.Path == "environment.env" {
			foundEnv = true
		}
		if f.Path == "event_log[0].status" {
			foundStatus = true
		}
	}

	if !foundEnv {
		t.Error("Did not find environment mismatch")
	}
	if !foundStatus {
		t.Error("Did not find event_log status mismatch")
	}
}

func TestDiffRuns_LengthMismatch(t *testing.T) {
	runA := map[string]any{
		"run_id":    "A",
		"event_log": []any{map[string]any{"id": 1}},
	}
	runB := map[string]any{
		"run_id":    "B",
		"event_log": []any{map[string]any{"id": 1}, map[string]any{"id": 2}},
	}

	diff := DiffRuns(runA, runB)

	foundLength := false
	foundExtra := false
	for _, f := range diff.Fields {
		if f.Path == "event_log" && f.Reason == "length mismatch" {
			foundLength = true
		}
		if f.Path == "event_log[1]" && f.Reason == "out of bounds in A" {
			foundExtra = true
		}
	}

	if !foundLength {
		t.Error("Did not find length mismatch")
	}
	if !foundExtra {
		t.Error("Did not find extra element details")
	}
}
