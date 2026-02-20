package packloader

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"
)

// LockfileName is the standard lockfile name.
const LockfileName = "reach-lock.json"

// Lockfile pins exact versions and hashes for all packs in a project.
// It ensures deterministic builds across environments.
type Lockfile struct {
	// Version of the lockfile format.
	Version string `json:"version"`

	// GeneratedAt is when the lockfile was last generated.
	GeneratedAt string `json:"generated_at"`

	// Packages maps pack ID to its locked entry.
	Packages map[string]LockEntry `json:"packages"`

	// IntegrityHash is a hash of all lock entries for tamper detection.
	IntegrityHash string `json:"integrity_hash"`
}

// LockEntry pins a single pack to an exact version and hash.
type LockEntry struct {
	ID           string   `json:"id"`
	Version      string   `json:"version"`
	Hash         string   `json:"hash"`
	Dependencies []string `json:"dependencies,omitempty"`
	Source       string   `json:"source,omitempty"` // "local", "registry"
	Resolved     string   `json:"resolved,omitempty"`
}

// NewLockfile creates a new empty lockfile.
func NewLockfile() *Lockfile {
	return &Lockfile{
		Version:  "1",
		Packages: make(map[string]LockEntry),
	}
}

// ReadLockfile reads and parses a lockfile from disk.
func ReadLockfile(path string) (*Lockfile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var lf Lockfile
	if err := json.Unmarshal(data, &lf); err != nil {
		return nil, fmt.Errorf("parsing lockfile: %w", err)
	}

	// Verify integrity
	if err := lf.VerifyIntegrity(); err != nil {
		return nil, fmt.Errorf("lockfile integrity check failed: %w", err)
	}

	return &lf, nil
}

// WriteLockfile writes the lockfile to disk with computed integrity hash.
func WriteLockfile(lf *Lockfile, path string) error {
	lf.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	lf.IntegrityHash = lf.computeIntegrity()

	data, err := json.MarshalIndent(lf, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling lockfile: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// AddEntry adds or updates a lock entry.
func (lf *Lockfile) AddEntry(entry LockEntry) {
	lf.Packages[entry.ID] = entry
}

// GetEntry returns the lock entry for a pack.
func (lf *Lockfile) GetEntry(packID string) (LockEntry, bool) {
	entry, ok := lf.Packages[packID]
	return entry, ok
}

// RemoveEntry removes a lock entry.
func (lf *Lockfile) RemoveEntry(packID string) {
	delete(lf.Packages, packID)
}

// VerifyIntegrity checks that the lockfile hasn't been tampered with.
func (lf *Lockfile) VerifyIntegrity() error {
	if lf.IntegrityHash == "" {
		return nil // No integrity hash to verify
	}

	computed := lf.computeIntegrity()
	if computed != lf.IntegrityHash {
		return fmt.Errorf("integrity mismatch: computed %s, expected %s", computed, lf.IntegrityHash)
	}
	return nil
}

// CheckConsistency verifies that all loaded packs match their lockfile entries.
func (lf *Lockfile) CheckConsistency(packs []*LoadedPack) []string {
	var mismatches []string

	for _, pack := range packs {
		if pack.Manifest == nil || pack.Disabled {
			continue
		}

		id := pack.Manifest.Metadata.ID
		entry, locked := lf.Packages[id]
		if !locked {
			mismatches = append(mismatches, fmt.Sprintf("pack %s is loaded but not in lockfile", id))
			continue
		}

		if entry.Version != pack.Manifest.Metadata.Version {
			mismatches = append(mismatches,
				fmt.Sprintf("pack %s version mismatch: lockfile=%s, loaded=%s", id, entry.Version, pack.Manifest.Metadata.Version))
		}

		if entry.Hash != "" && pack.Hash != "" && entry.Hash != pack.Hash {
			mismatches = append(mismatches,
				fmt.Sprintf("pack %s hash mismatch: lockfile=%s, loaded=%s", id, entry.Hash, pack.Hash))
		}
	}

	return mismatches
}

// GenerateFromPacks creates a lockfile from the currently loaded packs.
func GenerateFromPacks(packs []*LoadedPack) *Lockfile {
	lf := NewLockfile()

	for _, pack := range packs {
		if pack.Manifest == nil || pack.Disabled {
			continue
		}

		deps := make([]string, 0, len(pack.Manifest.Dependencies))
		for _, dep := range pack.Manifest.Dependencies {
			deps = append(deps, dep.ID)
		}

		source := "local"
		if pack.SourceDir == "" {
			source = "registry"
		}

		lf.AddEntry(LockEntry{
			ID:           pack.Manifest.Metadata.ID,
			Version:      pack.Manifest.Metadata.Version,
			Hash:         pack.Hash,
			Dependencies: deps,
			Source:       source,
		})
	}

	lf.IntegrityHash = lf.computeIntegrity()
	return lf
}

// computeIntegrity computes a SHA-256 hash of all lock entries in deterministic order.
func (lf *Lockfile) computeIntegrity() string {
	// Sort pack IDs for determinism
	ids := make([]string, 0, len(lf.Packages))
	for id := range lf.Packages {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	h := sha256.New()
	for _, id := range ids {
		entry := lf.Packages[id]
		data, _ := json.Marshal(entry)
		h.Write(data)
	}

	return hex.EncodeToString(h.Sum(nil))
}
