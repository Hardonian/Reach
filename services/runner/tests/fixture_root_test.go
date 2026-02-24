package tests

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func conformanceFixturePath(t *testing.T, fixtureFile string) string {
	t.Helper()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("unable to determine fixture helper location")
	}

	dir := filepath.Dir(currentFile)
	for {
		candidate := filepath.Join(dir, "testdata", "fixtures", "conformance", fixtureFile)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}

		next := filepath.Dir(dir)
		if next == dir {
			t.Fatalf("unable to resolve conformance fixture %q from %s", fixtureFile, currentFile)
		}
		dir = next
	}
}
