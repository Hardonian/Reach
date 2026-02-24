package trust

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type ObjectType string

const (
	ObjectTranscript     ObjectType = "transcript"
	ObjectCanonicalBytes ObjectType = "canonical-bytes"
	ObjectBundleManifest ObjectType = "bundle-manifest"
	ObjectStepProof      ObjectType = "step-proof"
)

var allowedObjectTypes = map[ObjectType]struct{}{
	ObjectTranscript:     {},
	ObjectCanonicalBytes: {},
	ObjectBundleManifest: {},
	ObjectStepProof:      {},
}

type CAS struct {
	root string
}

func DefaultCASRoot() string {
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return filepath.Join("data", "cas")
	}
	return filepath.Join(home, ".reach", "cas")
}

func NewCAS(root string) (*CAS, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("cas root is required")
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("create cas root: %w", err)
	}
	return &CAS{root: root}, nil
}

func (c *CAS) Put(t ObjectType, payload []byte) (string, error) {
	if err := validateType(t); err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	path := c.objectPath(t, hash)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", fmt.Errorf("mkdir object dir: %w", err)
	}
	if _, err := os.Stat(path); err == nil {
		return hash, nil
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, payload, 0o644); err != nil {
		return "", fmt.Errorf("write temp object: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		if _, stErr := os.Stat(path); stErr == nil {
			return hash, nil
		}
		return "", fmt.Errorf("commit object: %w", err)
	}
	return hash, nil
}

func (c *CAS) Get(t ObjectType, hash string) ([]byte, error) {
	if err := validateType(t); err != nil {
		return nil, err
	}
	if !validSHA256Hex(hash) {
		return nil, errors.New("invalid hash")
	}
	return os.ReadFile(c.objectPath(t, hash))
}

func (c *CAS) Has(t ObjectType, hash string) bool {
	_, err := c.Get(t, hash)
	return err == nil
}

func (c *CAS) Verify(t ObjectType, hash string) error {
	b, err := c.Get(t, hash)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(b)
	if hex.EncodeToString(sum[:]) != hash {
		return errors.New("object hash mismatch")
	}
	return nil
}

func (c *CAS) Status() (map[ObjectType]int, error) {
	counts := map[ObjectType]int{}
	for t := range allowedObjectTypes {
		d := filepath.Join(c.root, string(t))
		entries, err := os.ReadDir(d)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				counts[t] = 0
				continue
			}
			return nil, err
		}
		count := 0
		for _, e := range entries {
			if !e.IsDir() && validSHA256Hex(e.Name()) {
				count++
			}
		}
		counts[t] = count
	}
	return counts, nil
}

func (c *CAS) GC() (int, error) {
	deleted := 0
	for t := range allowedObjectTypes {
		d := filepath.Join(c.root, string(t))
		entries, err := os.ReadDir(d)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return deleted, err
		}
		for _, e := range entries {
			if e.IsDir() || validSHA256Hex(e.Name()) {
				continue
			}
			if err := os.Remove(filepath.Join(d, e.Name())); err != nil {
				return deleted, err
			}
			deleted++
		}
	}
	return deleted, nil
}

func (c *CAS) objectPath(t ObjectType, hash string) string {
	return filepath.Join(c.root, string(t), hash)
}

func validSHA256Hex(s string) bool {
	if len(s) != 64 {
		return false
	}
	for _, r := range s {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			return false
		}
	}
	return true
}

func validateType(t ObjectType) error {
	if _, ok := allowedObjectTypes[t]; !ok {
		keys := make([]string, 0, len(allowedObjectTypes))
		for k := range allowedObjectTypes {
			keys = append(keys, string(k))
		}
		sort.Strings(keys)
		return fmt.Errorf("invalid object type %q (allowed: %s)", t, strings.Join(keys, ", "))
	}
	return nil
}
