package packloader

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLockfile_AddAndGet(t *testing.T) {
	lf := NewLockfile()
	lf.AddEntry(LockEntry{
		ID:      "test-pack",
		Version: "1.0.0",
		Hash:    "abc123",
	})

	entry, ok := lf.GetEntry("test-pack")
	if !ok {
		t.Fatal("expected entry to exist")
	}
	if entry.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %s", entry.Version)
	}
	if entry.Hash != "abc123" {
		t.Errorf("expected hash abc123, got %s", entry.Hash)
	}
}

func TestLockfile_Remove(t *testing.T) {
	lf := NewLockfile()
	lf.AddEntry(LockEntry{ID: "test-pack", Version: "1.0.0"})
	lf.RemoveEntry("test-pack")

	_, ok := lf.GetEntry("test-pack")
	if ok {
		t.Error("expected entry to be removed")
	}
}

func TestLockfile_WriteAndRead(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "reach-lock.json")

	lf := NewLockfile()
	lf.AddEntry(LockEntry{
		ID:           "pack-a",
		Version:      "1.0.0",
		Hash:         "hash-a",
		Dependencies: []string{"pack-b"},
		Source:       "local",
	})
	lf.AddEntry(LockEntry{
		ID:      "pack-b",
		Version: "2.0.0",
		Hash:    "hash-b",
		Source:  "registry",
	})

	err := WriteLockfile(lf, path)
	if err != nil {
		t.Fatal(err)
	}

	// Verify file exists
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}

	// Read it back
	lf2, err := ReadLockfile(path)
	if err != nil {
		t.Fatal(err)
	}

	entryA, ok := lf2.GetEntry("pack-a")
	if !ok {
		t.Fatal("expected pack-a in read lockfile")
	}
	if entryA.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %s", entryA.Version)
	}
	if entryA.Hash != "hash-a" {
		t.Errorf("expected hash hash-a, got %s", entryA.Hash)
	}

	entryB, ok := lf2.GetEntry("pack-b")
	if !ok {
		t.Fatal("expected pack-b in read lockfile")
	}
	if entryB.Source != "registry" {
		t.Errorf("expected source registry, got %s", entryB.Source)
	}
}

func TestLockfile_IntegrityCheck(t *testing.T) {
	// Directly test VerifyIntegrity with a tampered lockfile struct
	lf := NewLockfile()
	lf.AddEntry(LockEntry{ID: "pack-a", Version: "1.0.0", Hash: "hash-a"})
	// Set a valid integrity hash
	lf.IntegrityHash = lf.computeIntegrity()

	// Verify it passes initially
	if err := lf.VerifyIntegrity(); err != nil {
		t.Fatalf("initial integrity check should pass: %v", err)
	}

	// Now tamper: change a package entry but keep the old hash
	lf.AddEntry(LockEntry{ID: "pack-a", Version: "2.0.0", Hash: "hash-tampered"})
	// IntegrityHash is still the old one

	if err := lf.VerifyIntegrity(); err == nil {
		t.Error("expected integrity check failure for tampered lockfile")
	}
}

func TestLockfile_CheckConsistency(t *testing.T) {
	lf := NewLockfile()
	lf.AddEntry(LockEntry{ID: "pack-a", Version: "1.0.0", Hash: "hash-a"})

	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-a", Version: "1.0.0"},
			},
			Hash: "hash-a",
		},
	}

	mismatches := lf.CheckConsistency(packs)
	if len(mismatches) != 0 {
		t.Errorf("expected no mismatches, got: %v", mismatches)
	}
}

func TestLockfile_CheckConsistency_VersionMismatch(t *testing.T) {
	lf := NewLockfile()
	lf.AddEntry(LockEntry{ID: "pack-a", Version: "1.0.0", Hash: "hash-a"})

	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-a", Version: "2.0.0"},
			},
			Hash: "hash-a",
		},
	}

	mismatches := lf.CheckConsistency(packs)
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch, got %d", len(mismatches))
	}
}

func TestLockfile_CheckConsistency_HashMismatch(t *testing.T) {
	lf := NewLockfile()
	lf.AddEntry(LockEntry{ID: "pack-a", Version: "1.0.0", Hash: "hash-a"})

	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-a", Version: "1.0.0"},
			},
			Hash: "hash-different",
		},
	}

	mismatches := lf.CheckConsistency(packs)
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch, got %d", len(mismatches))
	}
}

func TestLockfile_CheckConsistency_UnlockedPack(t *testing.T) {
	lf := NewLockfile()

	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-a", Version: "1.0.0"},
			},
			Hash: "hash-a",
		},
	}

	mismatches := lf.CheckConsistency(packs)
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch (unlocked pack), got %d", len(mismatches))
	}
}

func TestGenerateFromPacks(t *testing.T) {
	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-a", Version: "1.0.0"},
				Dependencies: []PackDependency{
					{ID: "pack-b", Version: "1.0.0"},
				},
			},
			Hash:      "hash-a",
			SourceDir: "/path/to/pack-a",
		},
		{
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-b", Version: "1.0.0"},
			},
			Hash:      "hash-b",
			SourceDir: "/path/to/pack-b",
		},
		{
			// Disabled pack should be skipped
			Manifest: &PackManifest{
				Metadata: PackMetadata{ID: "pack-broken", Version: "1.0.0"},
			},
			Disabled: true,
		},
	}

	lf := GenerateFromPacks(packs)
	if len(lf.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d", len(lf.Packages))
	}

	entryA, ok := lf.GetEntry("pack-a")
	if !ok {
		t.Fatal("expected pack-a")
	}
	if len(entryA.Dependencies) != 1 || entryA.Dependencies[0] != "pack-b" {
		t.Errorf("unexpected dependencies: %v", entryA.Dependencies)
	}
	if entryA.Source != "local" {
		t.Errorf("expected source=local, got %s", entryA.Source)
	}

	if lf.IntegrityHash == "" {
		t.Error("expected non-empty integrity hash")
	}
}

func TestLockfile_DeterministicIntegrity(t *testing.T) {
	packs := []*LoadedPack{
		{
			Manifest: &PackManifest{Metadata: PackMetadata{ID: "pack-b", Version: "1.0.0"}},
			Hash:     "hash-b",
		},
		{
			Manifest: &PackManifest{Metadata: PackMetadata{ID: "pack-a", Version: "1.0.0"}},
			Hash:     "hash-a",
		},
	}

	lf1 := GenerateFromPacks(packs)
	lf2 := GenerateFromPacks(packs)

	if lf1.IntegrityHash != lf2.IntegrityHash {
		t.Error("integrity hash should be deterministic regardless of order")
	}
}
