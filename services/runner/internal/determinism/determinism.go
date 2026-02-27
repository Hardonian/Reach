// Package determinism provides deterministic hashing and serialization utilities
// for the Reach execution engine. All hash operations use canonical serialization
// to ensure cross-platform, cross-run consistency.
package determinism

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"hash"
	"io"
	"sort"
	"sync"
)

// Pre-computed JSON literal constants to avoid repeated allocations
var (
	jsonOpenObj  = []byte("{")
	jsonCloseObj = []byte("}")
	jsonOpenArr  = []byte("[")
	jsonCloseArr = []byte("]")
	jsonComma    = []byte(",")
	jsonColon    = []byte(":")
	jsonNull     = []byte("null")
	jsonTrue     = []byte("true")
	jsonFalse    = []byte("false")
	jsonQuote    = []byte("\"")
	jsonEmptyStr = []byte("\"\"")
)

// Buffer pool for reducing allocations in hashing hot path
var (
	bufferPool = sync.Pool{
		New: func() interface{} {
			return &bufferWrapper{
				buf: make([]byte, 0, 4096),
			}
		},
	}
	hasherPool = sync.Pool{
		New: func() interface{} {
			return sha256.New()
		},
	}
)

// bufferWrapper wraps a byte buffer for pooling
type bufferWrapper struct {
	buf []byte
}

// Hash computes a SHA256 hash of the canonical JSON representation of v.
// This is the single source of truth for deterministic hashing in Reach.
// The hash is stable across:
//   - Different runs of the same code
//   - Different platforms (Linux, Windows, macOS)
//   - Different Go versions (within reason)
//
// The function ensures deterministic field ordering by canonicalizing maps before hashing.
func Hash(v any) string {
	// Get pooled resources
	bw := bufferPool.Get().(*bufferWrapper)
	defer bufferPool.Put(bw)
	bw.buf = bw.buf[:0]

	h := hasherPool.Get().(hash.Hash)
	defer hasherPool.Put(h)
	h.Reset()

	// Canonicalize and write directly to hasher
	canonicalizeToHasher(v, h)

	// Sum and encode directly to pooled buffer
	sum := h.Sum(bw.buf[:0])
	return hex.EncodeToString(sum)
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

// canonicalizeToHasher writes canonical JSON directly to an io.Writer.
// This avoids intermediate string/[]byte allocations.
func canonicalizeToHasher(v any, w io.Writer) {
	switch vv := v.(type) {
	case map[string]any:
		// Sort keys to ensure deterministic ordering
		keys := make([]string, 0, len(vv))
		for k := range vv {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		// Write JSON object directly
		w.Write(jsonOpenObj)
		for i, k := range keys {
			if i > 0 {
				w.Write(jsonComma)
			}
			w.Write(jsonQuote)
			w.Write([]byte(k))
			w.Write(jsonQuote)
			w.Write(jsonColon)
			canonicalizeToHasher(vv[k], w)
		}
		w.Write(jsonCloseObj)

	case []any:
		w.Write(jsonOpenArr)
		for i, elem := range vv {
			if i > 0 {
				w.Write(jsonComma)
			}
			canonicalizeToHasher(elem, w)
		}
		w.Write(jsonCloseArr)

	case string:
		// Escape and quote string
		w.Write(jsonQuote)
		w.Write([]byte(escapeString(vv)))
		w.Write(jsonQuote)

	case int:
		w.Write([]byte(fmtInt(vv)))

	case int64:
		w.Write([]byte(fmtInt(int(vv))))

	case float64:
		w.Write([]byte(fmtFloat(vv)))

	case bool:
		if vv {
			w.Write(jsonTrue)
		} else {
			w.Write(jsonFalse)
		}

	case nil:
		w.Write(jsonNull)

	default:
		// Fallback: use JSON marshal for unknown types
		b, _ := json.Marshal(vv)
		w.Write(b)
	}
}

// fmtInt formats an integer without allocations
func fmtInt(n int) string {
	if n == 0 {
		return "0"
	}
	var buf []byte
	if n < 0 {
		buf = append(buf, '-')
		n = -n
	}
	// Build digits in reverse
	for n > 0 {
		buf = append(buf, byte('0'+n%10))
		n /= 10
	}
	// Reverse
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}

// fmtFloat formats a float64 - we use json.Marshal for proper float encoding
func fmtFloat(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}

// escapeString escapes special characters in a JSON string
func escapeString(s string) string {
	var buf []byte
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '"':
			buf = append(buf, '\\', '"')
			case '\\':
			buf = append(buf, '\\', '\\')
		case '\n':
			buf = append(buf, '\\', 'n')
		case '\r':
			buf = append(buf, '\\', 'r')
		case '\t':
			buf = append(buf, '\\', 't')
		default:
			buf = append(buf, c)
		}
	}
	if buf == nil {
		return s
	}
	return string(buf)
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
