package trust

import (
	"os"
	"path/filepath"
	"testing"
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
