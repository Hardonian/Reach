package lockfile

import (
	"os"
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
	if out.SchemaVersion != CurrentSchemaVersion {
		t.Fatalf("unexpected schema version: %d", out.SchemaVersion)
	}
	if len(out.Packages) != 1 || out.Packages[0].Version != "1.0.0" {
		t.Fatalf("unexpected lockfile: %+v", out)
	}
}

func TestReadBackCompatWithoutSchemaVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reach.lock.json")
	legacy := `{"packages":[{"id":"conn.legacy","version":"0.9.0","hash":"h"}]}`
	if err := os.WriteFile(path, []byte(legacy), 0o644); err != nil {
		t.Fatalf("write legacy: %v", err)
	}
	out, err := Read(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if out.SchemaVersion != CurrentSchemaVersion {
		t.Fatalf("unexpected schema version: %d", out.SchemaVersion)
	}
	if len(out.Packages) != 1 || out.Packages[0].ID != "conn.legacy" {
		t.Fatalf("unexpected lockfile: %+v", out)
	}
}
