package determinism

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

// Hash computes a deterministic SHA-256 hash of the input value.
// It relies on CanonicalJSON to ensure stable serialization.
func Hash(v any) string {
	b := CanonicalJSONBytes(v)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// CanonicalJSON returns a deterministic JSON string.
// Go's encoding/json sorts map keys by default, which satisfies our baseline requirement.
func CanonicalJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func CanonicalJSONBytes(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
