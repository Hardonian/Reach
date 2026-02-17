package registry

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"reach/internal/packkit/config"
	packlock "reach/internal/packkit/lockfile"
	"reach/internal/packkit/manifest"
	packregistry "reach/internal/packkit/registry"
	"reach/internal/packkit/resolver"
	"reach/internal/packkit/signing"
)

type ConnectorManifest struct {
	manifest.Manifest
	Provider         string `json:"provider"`
	SignaturePath    string `json:"signature_path"`
	SigningPublicKey string `json:"signing_public_key,omitempty"`
}

type InstalledConnector struct {
	ConnectorManifest
	PinnedVersion string `json:"pinned_version"`
	VerifiedBy    string `json:"verified_by"`
	Hash          string `json:"hash"`
}

type InstallRequest struct {
	ID      string `json:"id"`
	Version string `json:"version"`
}

type Store struct {
	mu            sync.RWMutex
	registryRoot  string
	installedRoot string
	lockfilePath  string
	trustedKeys   map[string]string
	items         map[string]InstalledConnector
}

func NewStore(registryRoot, installedRoot, lockfilePath string, trustedKeys map[string]string) (*Store, error) {
	s := &Store{registryRoot: registryRoot, installedRoot: installedRoot, lockfilePath: lockfilePath, trustedKeys: trustedKeys, items: map[string]InstalledConnector{}}
	if err := os.MkdirAll(installedRoot, 0o755); err != nil {
		return nil, err
	}
	if err := s.reloadInstalled(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Available() ([]packregistry.PackageRef, error) {
	idx, err := packregistry.RegistryIndexRead(filepath.Join(s.registryRoot, "index.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return idx.Packages, nil
}

func (s *Store) ListInstalled() []InstalledConnector {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]InstalledConnector, 0, len(s.items))
	for _, v := range s.items {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (s *Store) Install(req InstallRequest) (InstalledConnector, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx, err := packregistry.RegistryIndexRead(filepath.Join(s.registryRoot, "index.json"))
	if err != nil {
		return InstalledConnector{}, err
	}
	if req.Version == "" {
		req.Version = ">=0.0.0"
	}
	pkg, err := resolver.ResolvePackage(req.ID, req.Version, idx)
	if err != nil {
		return InstalledConnector{}, err
	}

	manifestPath := filepath.Join(s.registryRoot, pkg.Manifest)
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return InstalledConnector{}, err
	}
	m, err := manifest.ParseManifest(manifestBytes)
	if err != nil {
		return InstalledConnector{}, err
	}

	bundlePath := filepath.Join(s.registryRoot, pkg.Bundle)
	bundleBytes, err := os.ReadFile(bundlePath)
	if err != nil {
		return InstalledConnector{}, err
	}
	h := sha256.Sum256(bundleBytes)
	actualHash := hex.EncodeToString(h[:])
	if m.PackageHash != "" && m.PackageHash != actualHash {
		return InstalledConnector{}, fmt.Errorf("package hash mismatch: %s != %s", m.PackageHash, actualHash)
	}

	verifiedBy := "unsigned"
	if !config.AllowUnsigned() {
		sigPath := filepath.Join(s.registryRoot, pkg.Sig)
		sigBytes, err := os.ReadFile(sigPath)
		if err != nil {
			return InstalledConnector{}, fmt.Errorf("signature required in prod mode: %w", err)
		}
		sig, err := signing.ParseSignature(sigBytes)
		if err != nil {
			return InstalledConnector{}, err
		}
		ok, keyID, err := signing.VerifyManifestSignature(manifestBytes, sig, s.trustedKeys)
		if err != nil {
			return InstalledConnector{}, err
		}
		if !ok {
			return InstalledConnector{}, errors.New("manifest signature verification failed")
		}
		verifiedBy = keyID
	}

	installDir := filepath.Join(s.installedRoot, req.ID)
	if err := os.MkdirAll(installDir, 0o755); err != nil {
		return InstalledConnector{}, err
	}
	if err := os.WriteFile(filepath.Join(installDir, "manifest.json"), manifestBytes, 0o644); err != nil {
		return InstalledConnector{}, err
	}
	if err := os.WriteFile(filepath.Join(installDir, "bundle.tgz"), bundleBytes, 0o644); err != nil {
		return InstalledConnector{}, err
	}

	installed := InstalledConnector{ConnectorManifest: ConnectorManifest{Manifest: m}, PinnedVersion: m.Version, VerifiedBy: verifiedBy, Hash: actualHash}
	s.items[m.ID] = installed
	if err := s.writeLockfile(); err != nil {
		return InstalledConnector{}, err
	}
	return installed, nil
}

func (s *Store) Uninstall(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, id)
	if err := os.RemoveAll(filepath.Join(s.installedRoot, id)); err != nil {
		return err
	}
	return s.writeLockfile()
}

func (s *Store) writeLockfile() error {
	lf := packlock.Lockfile{Packages: make([]packlock.Entry, 0, len(s.items))}
	for _, item := range s.items {
		lf.Packages = append(lf.Packages, packlock.Entry{ID: item.ID, Version: item.PinnedVersion, Hash: item.Hash})
	}
	sort.Slice(lf.Packages, func(i, j int) bool { return lf.Packages[i].ID < lf.Packages[j].ID })
	return packlock.Write(s.lockfilePath, lf)
}

func (s *Store) reloadInstalled() error {
	lf, err := packlock.Read(s.lockfilePath)
	if err != nil {
		return err
	}
	for _, e := range lf.Packages {
		manifestBytes, err := os.ReadFile(filepath.Join(s.installedRoot, e.ID, "manifest.json"))
		if err != nil {
			continue
		}
		m, err := manifest.ParseManifest(manifestBytes)
		if err != nil {
			continue
		}
		s.items[e.ID] = InstalledConnector{ConnectorManifest: ConnectorManifest{Manifest: m}, PinnedVersion: e.Version, Hash: e.Hash, VerifiedBy: "lockfile"}
	}
	return nil
}

func TrustedKeysFromFile(path string) (map[string]string, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, err
	}
	var out map[string]string
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}
