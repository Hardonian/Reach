package registry

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"reach/internal/packkit/config"
	packlock "reach/internal/packkit/lockfile"
	"reach/internal/packkit/manifest"
	packregistry "reach/internal/packkit/registry"
	"reach/internal/packkit/resolver"
	"reach/internal/packkit/signing"
)

const (
	defaultTimeout   = 8 * time.Second
	maxBundleSize    = 50 << 20
	maxManifestSize  = 1 << 20
	maxSignatureSize = 1 << 20
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
	ID           string `json:"id"`
	Version      string `json:"version"`
	AllowUpgrade bool   `json:"allow_upgrade"`
}

type Store struct {
	mu             sync.RWMutex
	registryRoot   string
	remoteIndexURL string
	cacheRoot      string
	installedRoot  string
	lockfilePath   string
	trustedKeys    map[string]string
	httpClient     *http.Client
	maxRetries     int
	items          map[string]InstalledConnector
	currentTier    string
	catalogCache   catalogCacheEntry
	catalogTTL     time.Duration
}

func NewStore(registryRoot, remoteIndexURL, cacheRoot, installedRoot, lockfilePath string, trustedKeys map[string]string) (*Store, error) {
	s := &Store{
		registryRoot:   registryRoot,
		remoteIndexURL: remoteIndexURL,
		cacheRoot:      cacheRoot,
		installedRoot:  installedRoot,
		lockfilePath:   lockfilePath,
		trustedKeys:    trustedKeys,
		httpClient:     &http.Client{Timeout: defaultTimeout},
		maxRetries:     3,
		items:          map[string]InstalledConnector{},
		currentTier:    "free",
		catalogTTL:     catalogTTL,
	}
	if err := os.MkdirAll(installedRoot, 0o755); err != nil {
		return nil, err
	}
	if cacheRoot != "" {
		if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
			return nil, err
		}
	}
	if err := s.reloadInstalled(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Available() ([]packregistry.Package, error) {
	idx, err := s.readIndex(context.Background())
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
	if req.Version == "" {
		req.Version = ">=0.0.0"
	}
	if existing, ok := s.items[req.ID]; ok && !req.AllowUpgrade {
		if req.Version == ">=0.0.0" || req.Version == existing.PinnedVersion || req.Version == "="+existing.PinnedVersion {
			return existing, nil
		}
		return InstalledConnector{}, fmt.Errorf("%s is pinned at %s; use explicit upgrade", req.ID, existing.PinnedVersion)
	}
	idx, err := s.readIndex(context.Background())
	if err != nil {
		return InstalledConnector{}, err
	}
	pkg, err := resolver.ResolvePackage(req.ID, req.Version, idx)
	if err != nil {
		return InstalledConnector{}, err
	}
	if existing, ok := s.items[req.ID]; ok && !req.AllowUpgrade && existing.PinnedVersion != pkg.Version {
		return InstalledConnector{}, fmt.Errorf("%s is pinned at %s; use explicit upgrade", req.ID, existing.PinnedVersion)
	}
	return s.installResolved(pkg)
}

func (s *Store) Upgrade(id string) (InstalledConnector, error) {
	return s.Install(InstallRequest{ID: id, Version: ">=0.0.0", AllowUpgrade: true})
}

func (s *Store) installResolved(pkg resolver.ResolvedPackage) (InstalledConnector, error) {
	var manifestBytes, bundleBytes, sigBytes []byte
	var err error
	if s.remoteIndexURL != "" {
		manifestBytes, err = s.fetchURLWithRetries(context.Background(), pkg.ManifestURL, maxManifestSize)
		if err != nil {
			return InstalledConnector{}, err
		}
		bundleBytes, err = s.fetchURLWithRetries(context.Background(), pkg.BundleURL, maxBundleSize)
		if err != nil {
			return InstalledConnector{}, err
		}
		if pkg.SignatureURL != "" {
			sigBytes, err = s.fetchURLWithRetries(context.Background(), pkg.SignatureURL, maxSignatureSize)
			if err != nil {
				return InstalledConnector{}, err
			}
		}
		_ = s.cacheRemote(pkg, manifestBytes, bundleBytes, sigBytes)
	} else {
		manifestBytes, err = os.ReadFile(filepath.Join(s.registryRoot, pkg.ManifestURL))
		if err != nil {
			return InstalledConnector{}, err
		}
		bundleBytes, err = os.ReadFile(filepath.Join(s.registryRoot, pkg.BundleURL))
		if err != nil {
			return InstalledConnector{}, err
		}
		if pkg.SignatureURL != "" {
			sigBytes, _ = os.ReadFile(filepath.Join(s.registryRoot, pkg.SignatureURL))
		}
	}

	m, err := manifest.ParseManifest(manifestBytes)
	if err != nil {
		return InstalledConnector{}, err
	}
	h := sha256.Sum256(bundleBytes)
	actualHash := hex.EncodeToString(h[:])
	if pkg.SHA256 != actualHash {
		return InstalledConnector{}, fmt.Errorf("package hash mismatch: %s != %s", pkg.SHA256, actualHash)
	}
	if m.PackageHash != "" && m.PackageHash != actualHash {
		return InstalledConnector{}, fmt.Errorf("manifest hash mismatch: %s != %s", m.PackageHash, actualHash)
	}

	verifiedBy := "unsigned"
	if !config.AllowUnsigned() {
		if len(sigBytes) == 0 {
			return InstalledConnector{}, fmt.Errorf("signature required in prod mode")
		}
		sig, err := signing.ParseSignature(sigBytes)
		if err != nil {
			return InstalledConnector{}, err
		}
		if sig.KeyID != pkg.SignatureKeyID {
			return InstalledConnector{}, fmt.Errorf("signature key mismatch: %s != %s", sig.KeyID, pkg.SignatureKeyID)
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

	installDir := filepath.Join(s.installedRoot, m.ID)
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

func (s *Store) readIndex(ctx context.Context) (packregistry.Index, error) {
	if s.remoteIndexURL != "" {
		data, err := s.fetchURLWithRetries(ctx, s.remoteIndexURL, maxManifestSize)
		if err != nil {
			return packregistry.Index{}, err
		}
		return packregistry.ParseIndex(data)
	}
	return packregistry.RegistryIndexRead(filepath.Join(s.registryRoot, "index.json"))
}

func (s *Store) fetchURLWithRetries(ctx context.Context, rawURL string, maxBytes int64) ([]byte, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "https" {
		return nil, fmt.Errorf("only https urls are allowed: %s", rawURL)
	}
	var lastErr error
	for attempt := 0; attempt < s.maxRetries; attempt++ {
		data, err := s.fetchURL(ctx, rawURL, maxBytes)
		if err == nil {
			return data, nil
		}
		lastErr = err
		time.Sleep(time.Duration(100*(attempt+1)) * time.Millisecond)
	}
	return nil, fmt.Errorf("fetch failed after retries: %w", lastErr)
}

func (s *Store) fetchURL(ctx context.Context, rawURL string, maxBytes int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, rawURL)
	}
	lr := io.LimitReader(resp.Body, maxBytes+1)
	data, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("remote payload exceeds max size: %s", rawURL)
	}
	return data, nil
}

func (s *Store) cacheRemote(pkg resolver.ResolvedPackage, manifestBytes, bundleBytes, sigBytes []byte) error {
	if s.cacheRoot == "" {
		return nil
	}
	dir := filepath.Join(s.cacheRoot, strings.ReplaceAll(pkg.ID, "/", "_"), pkg.Version)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), manifestBytes, 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "bundle.tgz"), bundleBytes, 0o644); err != nil {
		return err
	}
	if len(sigBytes) > 0 {
		if err := os.WriteFile(filepath.Join(dir, "manifest.sig"), sigBytes, 0o644); err != nil {
			return err
		}
	}
	return nil
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
