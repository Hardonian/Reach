package lockfile

import (
	"path/filepath"
	"testing"
)

func TestReadWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reach.lock.json")
	in := Lockfile{Packages: []Entry{{ID: "conn.github", Version: "1.0.0", Hash: "abc"}}}
	if err := Write(path, in); err != nil {
		t.Fatalf("write: %v", err)
	}
	out, err := Read(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(out.Packages) != 1 || out.Packages[0].Version != "1.0.0" {
		t.Fatalf("unexpected lockfile: %+v", out)
	}
}
