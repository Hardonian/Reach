package registry

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
)

type ConnectorManifest struct {
	ID               string   `json:"id"`
	Provider         string   `json:"provider"`
	Version          string   `json:"version"`
	Scopes           []string `json:"scopes"`
	Capabilities     []string `json:"capabilities"`
	PackageHash      string   `json:"package_hash"`
	Signature        string   `json:"signature"`
	SigningPublicKey string   `json:"signing_public_key"`
	Verified         bool     `json:"verified"`
}

type InstalledConnector struct {
	ConnectorManifest
	PinnedVersion string `json:"pinned_version"`
}

type InstallRequest struct {
	Manifest   ConnectorManifest `json:"manifest"`
	PackageB64 string            `json:"package_b64"`
	DevMode    bool              `json:"dev_mode"`
}

type Store struct {
	mu    sync.RWMutex
	items map[string]InstalledConnector
}

func NewStore() *Store { return &Store{items: map[string]InstalledConnector{}} }

func (s *Store) List() []InstalledConnector {
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
	if err := ValidateManifest(req.Manifest, req.PackageB64, req.DevMode); err != nil {
		return InstalledConnector{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.items[req.Manifest.ID]; ok && existing.PinnedVersion != req.Manifest.Version {
		return InstalledConnector{}, fmt.Errorf("version pin mismatch: connector %s pinned to %s", req.Manifest.ID, existing.PinnedVersion)
	}
	installed := InstalledConnector{ConnectorManifest: req.Manifest, PinnedVersion: req.Manifest.Version}
	installed.Verified = true
	s.items[req.Manifest.ID] = installed
	return installed, nil
}

func ValidateManifest(m ConnectorManifest, packageB64 string, devMode bool) error {
	if m.ID == "" || m.Provider == "" || m.Version == "" {
		return errors.New("manifest id/provider/version required")
	}
	if packageB64 == "" {
		return errors.New("package_b64 required")
	}
	decoded, err := base64.StdEncoding.DecodeString(packageB64)
	if err != nil {
		return fmt.Errorf("invalid package_b64: %w", err)
	}
	h := sha256.Sum256(decoded)
	actual := hex.EncodeToString(h[:])
	if m.PackageHash != actual {
		return fmt.Errorf("package hash mismatch: expected %s got %s", m.PackageHash, actual)
	}
	if devMode {
		return nil
	}
	if m.Signature == "" || m.SigningPublicKey == "" {
		return errors.New("unsigned connector rejected")
	}
	pk, err := base64.StdEncoding.DecodeString(m.SigningPublicKey)
	if err != nil {
		return fmt.Errorf("invalid signing public key: %w", err)
	}
	sig, err := base64.StdEncoding.DecodeString(m.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}
	payload, _ := json.Marshal(struct {
		ID           string   `json:"id"`
		Provider     string   `json:"provider"`
		Version      string   `json:"version"`
		Scopes       []string `json:"scopes"`
		Capabilities []string `json:"capabilities"`
		PackageHash  string   `json:"package_hash"`
	}{ID: m.ID, Provider: m.Provider, Version: m.Version, Scopes: m.Scopes, Capabilities: m.Capabilities, PackageHash: m.PackageHash})
	if !ed25519.Verify(ed25519.PublicKey(pk), payload, sig) {
		return errors.New("invalid connector signature")
	}
	return nil
}
