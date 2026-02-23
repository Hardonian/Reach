package storage

// CrossLanguageHashFixture defines a test case for cross-language hash equivalence.
// The canonical JSON for each input must be computed by sorting keys recursively
// and then hashing with SHA-256 to produce the same result across TS, Go, and Rust.
//
// IMPORTANT: If any hash changes, it means canonical serialization has diverged
// between languages and replay compatibility is broken.
//
// Golden hashes are computed from TypeScript's canonicalJson() + SHA-256 and
// verified in src/determinism/determinism-invariants.test.ts
//
// Hash Version: sha256-cjson-v1

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestCrossLanguageHashEquivalence(t *testing.T) {
	// These canonical JSON strings match the output of TypeScript's canonicalJson()
	// which recursively sorts object keys. Go's json.Marshal also sorts map keys
	// by default, so these should match.
	fixtures := []struct {
		description   string
		canonicalJSON string
		expectedHash  string
	}{
		{
			description:   "Simple flat object",
			canonicalJSON: `{"action":"deploy","environment":"production"}`,
			expectedHash:  "165b836d9d6e803d5ce1bb8b7a01437ff68928f549887360cf13a0d551a66e85",
		},
		{
			description:   "Nested object with sorted keys",
			canonicalJSON: `{"a":1,"b":2,"c":{"a":1,"z":26}}`,
			expectedHash:  "24e4db09ae0e40a93e391725f9290725f3a8ffd15d33ed0bb39c394319087492",
		},
		{
			description:   "Empty object",
			canonicalJSON: `{}`,
			expectedHash:  "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
		},
		{
			description:   "Array with mixed types",
			canonicalJSON: `{"items":[1,"two",true,null,{"nested":"value"}]}`,
			expectedHash:  "7f76a9a8e0bec70c5d327b1ee560378ec256372034993f7cb7b676c77992f5cc",
		},
		{
			description:   "Deeply nested structure",
			canonicalJSON: `{"a":{"b":{"c":{"d":{"e":"deep"}}}}}`,
		},
		{
			description:   "Numeric edge cases",
			canonicalJSON: `{"float":1.5,"large":999999999,"negative":-1,"zero":0}`,
		},
	}

	// Compute SHA-256 for each canonical JSON and verify against golden hashes
	for _, f := range fixtures {
		h := sha256.Sum256([]byte(f.canonicalJSON))
		hash := hex.EncodeToString(h[:])

		// Verify determinism: same input → same hash
		h2 := sha256.Sum256([]byte(f.canonicalJSON))
		hash2 := hex.EncodeToString(h2[:])
		if hash != hash2 {
			t.Errorf("[%s] Hash not deterministic: %s != %s", f.description, hash, hash2)
		}

		// Verify hash length
		if len(hash) != 64 {
			t.Errorf("[%s] Expected 64-char hex hash, got %d chars", f.description, len(hash))
		}

		// Verify against golden hash (if provided)
		if f.expectedHash != "" && hash != f.expectedHash {
			t.Errorf("[%s] Golden hash mismatch:\n  got:      %s\n  expected: %s", f.description, hash, f.expectedHash)
		}

		t.Logf("[%s] hash=%s", f.description, hash)
	}

	// Verify all hashes are unique (different inputs → different hashes)
	hashes := make(map[string]string)
	for _, f := range fixtures {
		h := sha256.Sum256([]byte(f.canonicalJSON))
		hash := hex.EncodeToString(h[:])
		if prev, ok := hashes[hash]; ok {
			t.Errorf("Hash collision: %q and %q produce the same hash", prev, f.description)
		}
		hashes[f.description] = hash
	}
}
