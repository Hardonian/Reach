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
	"sync"
	"time"
)

// DefaultCASMaxSize is the default maximum CAS size (10GB)
const DefaultCASMaxSize int64 = 10 * 1024 * 1024 * 1024

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

// EvictionPolicy defines the eviction strategy
type EvictionPolicy string

const (
	EvictionPolicyNone    EvictionPolicy = "none"
	EvictionPolicyLRU    EvictionPolicy = "lru"
	EvictionPolicySizeCap EvictionPolicy = "size-cap"
)

// CASStatus holds detailed status information about the CAS
type CASStatus struct {
	Root                string         `json:"root"`
	FormatVersion       string         `json:"format_version"`
	TotalSizeBytes      int64          `json:"total_size_bytes"`
	ObjectCount         int            `json:"object_count"`
	FragmentationRatio  float64        `json:"fragmentation_ratio"`
	ObjectsByType       map[string]int `json:"objects_by_type"`
	EvictionPolicy      string         `json:"eviction_policy"`
	MaxSizeBytes        int64          `json:"max_size_bytes"`
}

// CASConfig holds configuration for CAS behavior
type CASConfig struct {
	MaxCASSizeBytes     int64
	EvictionPolicy      EvictionPolicy
	LRUWindow           time.Duration
	AtomicWritesEnabled bool
}

// CAS is the Content Addressable Storage implementation
type CAS struct {
	root        string
	config      CASConfig
	lruMu       sync.RWMutex
	lruAccess   map[string]time.Time // hash -> last access time
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

// NewCASWithConfig creates a new CAS with explicit configuration
func NewCASWithConfig(root string, config CASConfig) (*CAS, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("cas root is required")
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("create cas root: %w", err)
	}
	// Set defaults
	if config.MaxCASSizeBytes == 0 {
		config.MaxCASSizeBytes = DefaultCASMaxSize
	}
	if config.LRUWindow == 0 {
		config.LRUWindow = 24 * time.Hour
	}
	return &CAS{
		root:      root,
		config:    config,
		lruAccess: make(map[string]time.Time),
	}, nil
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

// StatusEx returns detailed status information including size and object count
func (c *CAS) StatusEx() (*CASStatus, error) {
	status := &CASStatus{
		Root:             c.root,
		FormatVersion:    CACObjectFormatVersion,
		ObjectsByType:    make(map[string]int),
		EvictionPolicy:   string(c.config.EvictionPolicy),
		MaxSizeBytes:     c.config.MaxCASSizeBytes,
		TotalSizeBytes:   0,
		ObjectCount:      0,
		FragmentationRatio: 0,
	}

	// Calculate actual disk usage and object count
	var totalFileSize int64
	for t := range allowedObjectTypes {
		d := filepath.Join(c.root, string(t))
		entries, err := os.ReadDir(d)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				status.ObjectsByType[string(t)] = 0
				continue
			}
			return nil, err
		}
		count := 0
		for _, e := range entries {
			if e.IsDir() || validSHA256Hex(e.Name()) {
				count++
				// Get file size
				if info, err := e.Info(); err == nil {
					totalFileSize += info.Size()
				}
			}
		}
		status.ObjectsByType[string(t)] = count
		status.ObjectCount += count
	}

	status.TotalSizeBytes = totalFileSize

	// Calculate fragmentation ratio (actual size / expected minimum size)
	// If we have more disk usage than expected from object count, there's fragmentation
	minExpectedSize := int64(status.ObjectCount) * 1024 // Assume minimum 1KB per object
	if totalFileSize > minExpectedSize {
		status.FragmentationRatio = float64(totalFileSize-minExpectedSize) / float64(totalFileSize)
	}

	return status, nil
}

// Compact performs garbage collection to remove unreachable objects
// aggressive=true will perform full garbage collection
func (c *CAS) Compact(aggressive bool) (int, error) {
	deleted := 0

	// First do basic GC
	n, err := c.GC()
	if err != nil {
		return deleted, err
	}
	deleted += n

	if aggressive {
		// In aggressive mode, also clean up LRU entries that are too old
		if c.config.EvictionPolicy == EvictionPolicyLRU {
			n, err = c.evictOldLRU()
			if err != nil {
				return deleted, err
			}
			deleted += n
		}
	}

	return deleted, nil
}

// EvictLRU removes least recently used objects to free space
func (c *CAS) EvictLRU(targetBytes int64) (int64, error) {
	if c.config.EvictionPolicy != EvictionPolicyLRU {
		return 0, nil // Only evict if LRU policy is enabled
	}

	c.lruMu.Lock()
	defer c.lruMu.Unlock()

	// Get all objects sorted by access time
	var objects []struct {
		hash     string
		objType  ObjectType
		accessed time.Time
		size     int64
	}

	for t := range allowedObjectTypes {
		d := filepath.Join(c.root, string(t))
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !validSHA256Hex(e.Name()) {
				continue
			}
			info, _ := e.Info()
			accessed := c.lruAccess[e.Name()]
			if accessed.IsZero() {
				accessed = time.Now().Add(-c.config.LRUWindow * 2) // Older than 2 windows
			}
			objects = append(objects, struct {
				hash     string
				objType  ObjectType
				accessed time.Time
				size     int64
			}{e.Name(), t, accessed, info.Size()})
		}
	}

	// Sort by access time (oldest first)
	sort.Slice(objects, func(i, j int) bool {
		return objects[i].accessed.Before(objects[j].accessed)
	})

	// Delete oldest objects until we free enough space
	var freed int64
	deleted := 0
	for _, obj := range objects {
		if freed >= targetBytes {
			break
		}
		path := c.objectPath(obj.objType, obj.hash)
		if err := os.Remove(path); err == nil {
			freed += obj.size
			deleted++
			// Update LRU tracking - for deterministic order, use hash as tiebreaker
			sortedKeys := make([]string, 0, len(c.lruAccess))
			for k := range c.lruAccess {
				sortedKeys = append(sortedKeys, k)
			}
			sort.Strings(sortedKeys)
			for _, k := range sortedKeys {
				if k == obj.hash {
					delete(c.lruAccess, k)
					break
				}
			}
		}
	}

	return freed, nil
}

// evictOldLRU removes LRU entries that are outside the retention window
func (c *CAS) evictOldLRU() (int, error) {
	c.lruMu.Lock()
	defer c.lruMu.Unlock()

	cutoff := time.Now().Add(-c.config.LRUWindow)
	deleted := 0

	for hash, accessed := range c.lruAccess {
		if accessed.Before(cutoff) {
			delete(c.lruAccess, hash)
			deleted++
		}
	}

	return deleted, nil
}

// EvictSizeCap enforces the maximum CAS size limit
func (c *CAS) EvictSizeCap() (int64, error) {
	if c.config.EvictionPolicy != EvictionPolicySizeCap {
		return 0, nil
	}

	if c.config.MaxCASSizeBytes <= 0 {
		return 0, nil
	}

	// Get current status
	status, err := c.StatusEx()
	if err != nil {
		return 0, err
	}

	if status.TotalSizeBytes <= c.config.MaxCASSizeBytes {
		return 0, nil
	}

	// Need to free targetBytes
	targetBytes := status.TotalSizeBytes - c.config.MaxCASSizeBytes
	return c.EvictLRU(targetBytes)
}

// UpdateLRU records an access for LRU tracking
func (c *CAS) UpdateLRU(t ObjectType, hash string) {
	if c.config.EvictionPolicy != EvictionPolicyLRU {
		return
	}

	c.lruMu.Lock()
	defer c.lruMu.Unlock()
	c.lruAccess[hash] = time.Now()
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
