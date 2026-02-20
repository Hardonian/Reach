package packloader

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestCompatLayer_Bootstrap_CLI(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)
	createTestPack(t, dir, "pack-b", "1.0.0", nil)

	cl := NewCompatLayer(CompatConfig{
		Environment: EnvCLI,
		SearchDirs:  []string{dir},
		Policy:      DefaultContainmentPolicy(),
	})

	result, err := cl.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}

	if result.Environment != EnvCLI {
		t.Errorf("expected CLI environment, got %s", result.Environment)
	}
	if result.TotalLoaded != 2 {
		t.Errorf("expected 2 loaded, got %d", result.TotalLoaded)
	}
	if result.TotalFailed != 0 {
		t.Errorf("expected 0 failed, got %d", result.TotalFailed)
	}
}

func TestCompatLayer_Bootstrap_Web(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	cl := NewCompatLayer(CompatConfig{
		Environment: EnvWeb,
		SearchDirs:  []string{dir},
		Policy:      DefaultContainmentPolicy(),
	})

	result, err := cl.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}

	if result.Environment != EnvWeb {
		t.Errorf("expected Web environment, got %s", result.Environment)
	}
	if result.TotalLoaded != 1 {
		t.Errorf("expected 1 loaded, got %d", result.TotalLoaded)
	}
}

func TestCompatLayer_Bootstrap_WithInvalidPack(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "good-pack", "1.0.0", nil)

	// Create invalid pack
	badDir := filepath.Join(dir, "bad-pack")
	os.MkdirAll(badDir, 0755)
	os.WriteFile(filepath.Join(badDir, "pack.json"), []byte(`{"schema_version":"1.0.0"}`), 0644)

	cl := NewCompatLayer(CompatConfig{
		Environment: EnvCLI,
		SearchDirs:  []string{dir},
		Policy:      DefaultContainmentPolicy(),
	})

	result, err := cl.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}

	// good-pack loads, bad-pack is disabled
	if result.TotalLoaded != 1 {
		t.Errorf("expected 1 loaded, got %d", result.TotalLoaded)
	}
	if result.TotalFailed != 1 {
		t.Errorf("expected 1 failed, got %d", result.TotalFailed)
	}
}

func TestCompatLayer_Bootstrap_EmptyDir(t *testing.T) {
	dir := t.TempDir()

	cl := NewCompatLayer(CompatConfig{
		Environment: EnvCLI,
		SearchDirs:  []string{dir},
		Policy:      DefaultContainmentPolicy(),
	})

	result, err := cl.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}

	if result.TotalLoaded != 0 {
		t.Errorf("expected 0 loaded, got %d", result.TotalLoaded)
	}
}

func TestCompatLayer_Accessors(t *testing.T) {
	cl := NewCompatLayer(CompatConfig{
		Environment: EnvCLI,
		SearchDirs:  []string{},
		Policy:      DefaultContainmentPolicy(),
	})

	if cl.Loader() == nil {
		t.Error("loader should not be nil")
	}
	if cl.Sandbox() == nil {
		t.Error("sandbox should not be nil")
	}
	if cl.Injector() == nil {
		t.Error("injector should not be nil")
	}
	if cl.Health() == nil {
		t.Error("health should not be nil")
	}
	if cl.Env() != EnvCLI {
		t.Errorf("expected CLI, got %s", cl.Env())
	}
}

func TestCompatLayer_GenerateLockfile_CLI(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	lockPath := filepath.Join(dir, "reach-lock.json")
	cl := NewCompatLayer(CompatConfig{
		Environment:  EnvCLI,
		SearchDirs:   []string{dir},
		LockfilePath: lockPath,
		Policy:       DefaultContainmentPolicy(),
	})

	cl.Bootstrap()
	lf, err := cl.GenerateLockfile()
	if err != nil {
		t.Fatal(err)
	}

	if len(lf.Packages) != 1 {
		t.Errorf("expected 1 package in lockfile, got %d", len(lf.Packages))
	}

	// Verify file was written
	if _, err := os.Stat(lockPath); err != nil {
		t.Errorf("lockfile should exist: %v", err)
	}
}

func TestCompatLayer_GenerateLockfile_WebNotAllowed(t *testing.T) {
	cl := NewCompatLayer(CompatConfig{
		Environment: EnvWeb,
		Policy:      DefaultContainmentPolicy(),
	})

	_, err := cl.GenerateLockfile()
	if err == nil {
		t.Error("expected error for lockfile generation in web mode")
	}
}

func TestCompatLayer_BootstrapWithLockfile(t *testing.T) {
	dir := t.TempDir()
	createTestPack(t, dir, "pack-a", "1.0.0", nil)

	lockPath := filepath.Join(dir, "reach-lock.json")

	// First bootstrap to get the hash
	cl := NewCompatLayer(CompatConfig{
		Environment:  EnvCLI,
		SearchDirs:   []string{dir},
		LockfilePath: lockPath,
		Policy:       DefaultContainmentPolicy(),
	})
	cl.Bootstrap()
	cl.GenerateLockfile()

	// Second bootstrap should check lockfile
	cl2 := NewCompatLayer(CompatConfig{
		Environment:  EnvCLI,
		SearchDirs:   []string{dir},
		LockfilePath: lockPath,
		Policy:       DefaultContainmentPolicy(),
	})
	result, err := cl2.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}

	if len(result.LockfileMismatches) != 0 {
		t.Errorf("expected no lockfile mismatches, got: %v", result.LockfileMismatches)
	}
}

func TestBootstrapResult_ToJSON(t *testing.T) {
	result := &BootstrapResult{
		Environment: EnvCLI,
		TotalLoaded: 1,
		Loaded: []PackLoadResult{
			{PackID: "pack-a", Version: "1.0.0"},
		},
	}

	data, err := result.ToJSON()
	if err != nil {
		t.Fatal(err)
	}

	var parsed BootstrapResult
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed.TotalLoaded != 1 {
		t.Errorf("expected 1 loaded, got %d", parsed.TotalLoaded)
	}
}
