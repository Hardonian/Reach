// Package determinism provides deterministic hashing and serialization utilities
// for the Reach execution engine. All hash operations use canonical serialization
// to ensure cross-platform, cross-run consistency.
package determinism

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

// Hash computes a SHA256 hash of the canonical JSON representation of v.
// This is the single source of truth for deterministic hashing in Reach.
// The hash is stable across:
//   - Different runs of the same code
//   - Different platforms (Linux, Windows, macOS)
//   - Different Go versions (within reason)
//
// The function ensures deterministic field ordering by canonicalizing maps before hashing.
func Hash(v any) string {
	b := []byte(CanonicalJSON(v))
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// CanonicalJSON returns a deterministic JSON representation of v.
// Map keys are sorted alphabetically to ensure consistent ordering.
// This is safe because the canonicalization creates a new structure
// and does not modify the input.
func CanonicalJSON(v any) string {
	canon := canonicalize(v)
	b, _ := json.Marshal(canon)
	return string(b)
}

// canonicalize recursively converts v into a canonical form suitable for
// deterministic serialization. Maps are converted to have sorted keys.
// This function is safe: it does not modify the input values.
func canonicalize(v any) any {
	switch vv := v.(type) {
	case map[string]any:
		// Sort keys to ensure deterministic ordering
		keys := make([]string, 0, len(vv))
		for k := range vv {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		// Build new map with canonicalized values
		res := make(map[string]any, len(keys))
		for _, k := range keys {
			res[k] = canonicalize(vv[k])
		}
		return res

	case []any:
		// Canonicalize each element; slice order is preserved
		res := make([]any, len(vv))
		for i := range vv {
			res[i] = canonicalize(vv[i])
		}
		return res

	default:
		// Primitives are returned as-is
		return vv
	}
}

// HashEventLog computes a deterministic hash of an event log for replay verification.
// The eventLog should be a slice of map[string]any or structs that serialize to JSON objects.
// The runID is included in the hash to bind the event log to a specific run.
func HashEventLog(eventLog []map[string]any, runID string) string {
	return Hash(map[string]any{"event_log": eventLog, "run_id": runID})
}

// VerifyReplay checks if a replayed event log matches the original fingerprint.
// Returns true if the replay is verified (deterministic), false otherwise.
func VerifyReplay(eventLog []map[string]any, runID string, expectedFingerprint string) bool {
	recomputed := HashEventLog(eventLog, runID)
	return recomputed == expectedFingerprint
}
