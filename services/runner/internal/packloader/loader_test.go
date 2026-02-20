package packloader

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func createTestPack(t *testing.T, dir, id, version string, deps []PackDependency) string {
	t.Helper()
	packDir := filepath.Join(dir, id)
	if err := os.MkdirAll(packDir, 0755); err != nil {
		t.Fatal(err)
	}

	m := &PackManifest{
		SchemaVersion:       "1.0.0",
		Metadata:            PackMetadata{ID: id, Version: version, Name: id},
		DeclaredTools:       []string{"read_file"},
		DeclaredPermissions: []string{"fs:read"},
		Dependencies:        deps,
	}

	data, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(packDir, "pack.json"), data, 0644); err != nil {
		t.Fatal(err)
	}
	return packDir
}

func TestLoader_DiscoverPacks(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-b", "1.0.0", nil)
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	loader := NewLoader(dir)
	paths, err := loader.DiscoverPacks()
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) != 2 {
		t.Fatalf("expected 2 packs, got %d", len(paths))
	}
	// Must be sorted
	if filepath.Base(paths[0]) != "pack-a" {
		t.Errorf("expected pack-a first, got %s", filepath.Base(paths[0]))
	}
	if filepath.Base(paths[1]) != "pack-b" {
		t.Errorf("expected pack-b second, got %s", filepath.Base(paths[1]))
	}
}

func TestLoader_DiscoverPacks_NonexistentDir(t *testing.T) {
	loader := NewLoader("/nonexistent/dir")
	paths, err := loader.DiscoverPacks()
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) != 0 {
		t.Errorf("expected 0 packs, got %d", len(paths))
	}
}

func TestLoader_LoadFromDir(t *testing.T) {
	dir := t.TempDir()
	packDir := createTestPack(t, dir, "test-pack", "1.0.0", nil)

	loader := NewLoader(dir)
	pack, err := loader.LoadFromDir(packDir)
	if err != nil {
		t.Fatal(err)
	}
	if pack.Disabled {
		t.Errorf("pack should not be disabled: %s", pack.Error)
	}
	if pack.Manifest.Metadata.ID != "test-pack" {
		t.Errorf("unexpected ID: %s", pack.Manifest.Metadata.ID)
	}
	if pack.Hash == "" {
		t.Error("expected non-empty hash")
	}
}

func TestLoader_LoadFromDir_InvalidManifest(t *testing.T) {
	dir := t.TempDir()
	packDir := filepath.Join(dir, "bad-pack")
	os.MkdirAll(packDir, 0755)
	os.WriteFile(filepath.Join(packDir, "pack.json"), []byte(`{"schema_version":"1.0.0"}`), 0644)

	loader := NewLoader(dir)
	pack, err := loader.LoadFromDir(packDir)
	if err != nil {
		t.Fatal(err)
	}
	if !pack.Disabled {
		t.Error("expected disabled pack for invalid manifest")
	}
}

func TestLoader_LoadFromDir_MissingManifest(t *testing.T) {
	dir := t.TempDir()
	packDir := filepath.Join(dir, "empty-pack")
	os.MkdirAll(packDir, 0755)

	loader := NewLoader(dir)
	_, err := loader.LoadFromDir(packDir)
	if err == nil {
		t.Error("expected error for missing pack.json")
	}
}

func TestLoader_LoadAll_DeterministicOrder(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-c", "1.0.0", nil)
	createTestPack(t, dir, "pack-a", "1.0.0", nil)
	createTestPack(t, dir, "pack-b", "1.0.0", nil)

	loader := NewLoader(dir)
	packs, err := loader.LoadAll()
	if err != nil {
		t.Fatal(err)
	}

	// Filter to enabled packs
	var enabled []*LoadedPack
	for _, p := range packs {
		if !p.Disabled {
			enabled = append(enabled, p)
		}
	}

	if len(enabled) != 3 {
		t.Fatalf("expected 3 enabled packs, got %d", len(enabled))
	}

	// Should be alphabetical since no deps
	if enabled[0].Manifest.Metadata.ID != "pack-a" {
		t.Errorf("expected pack-a first, got %s", enabled[0].Manifest.Metadata.ID)
	}
	if enabled[1].Manifest.Metadata.ID != "pack-b" {
		t.Errorf("expected pack-b second, got %s", enabled[1].Manifest.Metadata.ID)
	}
	if enabled[2].Manifest.Metadata.ID != "pack-c" {
		t.Errorf("expected pack-c third, got %s", enabled[2].Manifest.Metadata.ID)
	}
}

func TestLoader_LoadAll_TopologicalOrder(t *testing.T) {
	dir := t.TempDir()
	// pack-b depends on pack-a
	createTestPack(t, dir, "pack-a", "1.0.0", nil)
	createTestPack(t, dir, "pack-b", "1.0.0", []PackDependency{
		{ID: "pack-a", Version: "1.0.0"},
	})

	loader := NewLoader(dir)
	packs, err := loader.LoadAll()
	if err != nil {
		t.Fatal(err)
	}

	var enabled []*LoadedPack
	for _, p := range packs {
		if !p.Disabled {
			enabled = append(enabled, p)
		}
	}

	if len(enabled) != 2 {
		t.Fatalf("expected 2 enabled packs, got %d", len(enabled))
	}
	// pack-a must come before pack-b
	if enabled[0].Manifest.Metadata.ID != "pack-a" {
		t.Errorf("expected pack-a first (dependency), got %s", enabled[0].Manifest.Metadata.ID)
	}
	if enabled[1].Manifest.Metadata.ID != "pack-b" {
		t.Errorf("expected pack-b second (dependent), got %s", enabled[1].Manifest.Metadata.ID)
	}
}

func TestLoader_LoadAll_CircularDependency(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", []PackDependency{
		{ID: "pack-b", Version: "1.0.0"},
	})
	createTestPack(t, dir, "pack-b", "1.0.0", []PackDependency{
		{ID: "pack-a", Version: "1.0.0"},
	})

	loader := NewLoader(dir)
	_, err := loader.LoadAll()
	if err == nil {
		t.Error("expected error for circular dependency")
	}
}

func TestLoader_LoadAll_OptionalMissingDep(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", []PackDependency{
		{ID: "pack-missing", Version: "1.0.0", Optional: true},
	})

	loader := NewLoader(dir)
	packs, err := loader.LoadAll()
	if err != nil {
		t.Fatalf("optional missing dep should not fail: %v", err)
	}
	if len(packs) == 0 {
		t.Error("expected at least 1 pack")
	}
}

func TestLoader_LoadAll_RequiredMissingDep(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", []PackDependency{
		{ID: "pack-missing", Version: "1.0.0", Optional: false},
	})

	loader := NewLoader(dir)
	_, err := loader.LoadAll()
	if err == nil {
		t.Error("expected error for required missing dependency")
	}
}

func TestLoader_GetAndList(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	loader := NewLoader(dir)
	loader.LoadAll()

	p, ok := loader.Get("pack-a")
	if !ok {
		t.Error("expected to find pack-a")
	}
	if p.Manifest.Metadata.ID != "pack-a" {
		t.Errorf("unexpected ID: %s", p.Manifest.Metadata.ID)
	}

	list := loader.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 in list, got %d", len(list))
	}
	if list[0] != "pack-a" {
		t.Errorf("unexpected list entry: %s", list[0])
	}
}

func TestLoader_RegisterUnregister(t *testing.T) {
	loader := NewLoader()

	pack := &LoadedPack{
		Manifest: &PackManifest{
			SchemaVersion: "1.0.0",
			Metadata:      PackMetadata{ID: "dynamic-pack", Version: "1.0.0", Name: "Dynamic"},
			DeclaredTools: []string{"test_tool"},
		},
	}

	if err := loader.Register(pack); err != nil {
		t.Fatal(err)
	}

	if _, ok := loader.Get("dynamic-pack"); !ok {
		t.Error("expected to find registered pack")
	}

	loader.Unregister("dynamic-pack")
	if _, ok := loader.Get("dynamic-pack"); ok {
		t.Error("expected pack to be unregistered")
	}
}

func TestLoader_Snapshot(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	loader := NewLoader(dir)
	loader.LoadAll()

	data, err := loader.Snapshot()
	if err != nil {
		t.Fatal(err)
	}

	var snap struct {
		LoadOrder []string      `json:"load_order"`
		Packs     []*LoadedPack `json:"packs"`
	}
	if err := json.Unmarshal(data, &snap); err != nil {
		t.Fatal(err)
	}
	if len(snap.LoadOrder) != 1 {
		t.Errorf("expected 1 in load order, got %d", len(snap.LoadOrder))
	}
}

func TestLoader_LoadFromData(t *testing.T) {
	m := &PackManifest{
		SchemaVersion:       "1.0.0",
		Metadata:            PackMetadata{ID: "inline-pack", Version: "1.0.0", Name: "Inline"},
		DeclaredTools:       []string{"read_file"},
		DeclaredPermissions: []string{"fs:read"},
	}
	data, _ := json.Marshal(m)

	loader := NewLoader()
	pack, err := loader.LoadFromData(data, "")
	if err != nil {
		t.Fatal(err)
	}
	if pack.Disabled {
		t.Errorf("expected enabled pack: %s", pack.Error)
	}
	if pack.Manifest.Metadata.ID != "inline-pack" {
		t.Errorf("unexpected ID: %s", pack.Manifest.Metadata.ID)
	}
}
