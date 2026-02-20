package packloader

import (
	"encoding/json"
	"fmt"
	"sync"
)

// Environment identifies the runtime environment.
type Environment string

const (
	EnvCLI Environment = "cli"
	EnvWeb Environment = "web"
)

// CompatLayer provides a unified interface for the pack system that works
// across CLI and web environments. It adapts pack loading, validation, and
// execution to work regardless of the runtime context.
type CompatLayer struct {
	mu       sync.RWMutex
	env      Environment
	loader   *Loader
	sandbox  *PackSandbox
	injector *RuntimeInjector
	health   *FailureContainment

	// lockfilePath is the path to the lockfile (CLI-only, empty for web).
	lockfilePath string
}

// CompatConfig configures the compatibility layer.
type CompatConfig struct {
	Environment  Environment
	SearchDirs   []string
	LockfilePath string
	Policy       ContainmentPolicy
}

// NewCompatLayer creates a new compatibility layer for the given environment.
func NewCompatLayer(cfg CompatConfig) *CompatLayer {
	sandbox := NewPackSandbox()
	return &CompatLayer{
		env:          cfg.Environment,
		loader:       NewLoader(cfg.SearchDirs...),
		sandbox:      sandbox,
		injector:     NewRuntimeInjector(sandbox),
		health:       NewFailureContainment(cfg.Policy),
		lockfilePath: cfg.LockfilePath,
	}
}

// Bootstrap loads all packs and wires them into the runtime.
// This is the main entry point for both CLI and web.
func (cl *CompatLayer) Bootstrap() (*BootstrapResult, error) {
	result := &BootstrapResult{
		Environment: cl.env,
	}

	// Load all packs
	packs, err := cl.loader.LoadAll()
	if err != nil {
		return nil, fmt.Errorf("loading packs: %w", err)
	}

	// Check lockfile consistency (CLI mode only)
	if cl.env == EnvCLI && cl.lockfilePath != "" {
		lf, lfErr := ReadLockfile(cl.lockfilePath)
		if lfErr == nil {
			mismatches := lf.CheckConsistency(packs)
			result.LockfileMismatches = mismatches
		}
	}

	// Register and inject each pack
	for _, pack := range packs {
		if pack.Manifest == nil {
			result.Failed = append(result.Failed, PackLoadResult{
				SourceDir: pack.SourceDir,
				Error:     pack.Error,
			})
			continue
		}

		id := pack.Manifest.Metadata.ID

		// Register in sandbox
		if err := cl.sandbox.RegisterPack(pack); err != nil {
			result.Failed = append(result.Failed, PackLoadResult{
				PackID:    id,
				SourceDir: pack.SourceDir,
				Error:     fmt.Sprintf("sandbox registration: %v", err),
			})
			continue
		}

		// Register health tracking
		cl.health.Register(id)

		if pack.Disabled {
			cl.health.DisablePack(id, pack.Error)
			result.Disabled = append(result.Disabled, PackLoadResult{
				PackID:    id,
				Version:   pack.Manifest.Metadata.Version,
				SourceDir: pack.SourceDir,
				Error:     pack.Error,
			})
			continue
		}

		// Inject into runtime
		if err := cl.injector.InjectPack(pack); err != nil {
			cl.health.DisablePack(id, err.Error())
			result.Failed = append(result.Failed, PackLoadResult{
				PackID:    id,
				Version:   pack.Manifest.Metadata.Version,
				SourceDir: pack.SourceDir,
				Error:     fmt.Sprintf("injection: %v", err),
			})
			continue
		}

		result.Loaded = append(result.Loaded, PackLoadResult{
			PackID:    id,
			Version:   pack.Manifest.Metadata.Version,
			Hash:      pack.Hash,
			SourceDir: pack.SourceDir,
		})
	}

	result.TotalLoaded = len(result.Loaded)
	result.TotalFailed = len(result.Failed) + len(result.Disabled)
	return result, nil
}

// BootstrapResult summarizes what happened during bootstrap.
type BootstrapResult struct {
	Environment        Environment      `json:"environment"`
	TotalLoaded        int              `json:"total_loaded"`
	TotalFailed        int              `json:"total_failed"`
	Loaded             []PackLoadResult `json:"loaded,omitempty"`
	Failed             []PackLoadResult `json:"failed,omitempty"`
	Disabled           []PackLoadResult `json:"disabled,omitempty"`
	LockfileMismatches []string         `json:"lockfile_mismatches,omitempty"`
}

// PackLoadResult is the outcome of loading a single pack.
type PackLoadResult struct {
	PackID    string `json:"pack_id,omitempty"`
	Version   string `json:"version,omitempty"`
	Hash      string `json:"hash,omitempty"`
	SourceDir string `json:"source_dir,omitempty"`
	Error     string `json:"error,omitempty"`
}

// ToJSON serializes the bootstrap result.
func (r *BootstrapResult) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// Loader returns the underlying pack loader.
func (cl *CompatLayer) Loader() *Loader {
	return cl.loader
}

// Sandbox returns the underlying sandbox.
func (cl *CompatLayer) Sandbox() *PackSandbox {
	return cl.sandbox
}

// Injector returns the underlying runtime injector.
func (cl *CompatLayer) Injector() *RuntimeInjector {
	return cl.injector
}

// Health returns the underlying failure containment system.
func (cl *CompatLayer) Health() *FailureContainment {
	return cl.health
}

// Env returns the current environment.
func (cl *CompatLayer) Env() Environment {
	return cl.env
}

// GenerateLockfile creates a lockfile from the currently loaded packs.
// Only applicable in CLI mode.
func (cl *CompatLayer) GenerateLockfile() (*Lockfile, error) {
	if cl.env != EnvCLI {
		return nil, fmt.Errorf("lockfile generation only supported in CLI mode")
	}

	ids := cl.loader.List()
	var packs []*LoadedPack
	for _, id := range ids {
		if p, ok := cl.loader.Get(id); ok {
			packs = append(packs, p)
		}
	}

	lf := GenerateFromPacks(packs)

	if cl.lockfilePath != "" {
		if err := WriteLockfile(lf, cl.lockfilePath); err != nil {
			return nil, fmt.Errorf("writing lockfile: %w", err)
		}
	}

	return lf, nil
}
