package packloader

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

// LoadedPack represents a fully validated and loaded pack, ready for execution.
type LoadedPack struct {
	Manifest  *PackManifest `json:"manifest"`
	Hash      string        `json:"hash"`
	SourceDir string        `json:"source_dir"`
	Disabled  bool          `json:"disabled"`
	Error     string        `json:"error,omitempty"`
}

// LoadOrder defines the deterministic ordering for packs.
// Packs are sorted by: dependencies first (topological), then alphabetical by ID.
type LoadOrder struct {
	PackIDs []string
	graph   map[string][]string // pack ID -> dependency IDs
}

// Loader is the core pack loading engine. It reads manifests from disk or
// in-memory sources, validates them, resolves dependencies in deterministic
// topological order, and produces LoadedPack instances that can be injected
// into the runtime.
type Loader struct {
	mu         sync.RWMutex
	packs      map[string]*LoadedPack // keyed by pack ID
	loadOrder  []string               // deterministic order
	searchDirs []string               // directories to search for packs
}

// NewLoader creates a new pack loader with the given search directories.
func NewLoader(searchDirs ...string) *Loader {
	return &Loader{
		packs:      make(map[string]*LoadedPack),
		searchDirs: searchDirs,
	}
}

// DiscoverPacks scans search directories for pack manifests (pack.json files).
// Returns discovered pack paths in deterministic (sorted) order.
func (l *Loader) DiscoverPacks() ([]string, error) {
	var paths []string

	for _, dir := range l.searchDirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("reading pack directory %s: %w", dir, err)
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			manifestPath := filepath.Join(dir, entry.Name(), "pack.json")
			if _, err := os.Stat(manifestPath); err == nil {
				paths = append(paths, filepath.Join(dir, entry.Name()))
			}
		}
	}

	// Deterministic order: sort by path
	sort.Strings(paths)
	return paths, nil
}

// LoadFromDir loads a single pack from a directory containing pack.json.
func (l *Loader) LoadFromDir(dir string) (*LoadedPack, error) {
	manifestPath := filepath.Join(dir, "pack.json")

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("reading manifest: %w", err)
	}

	return l.LoadFromData(data, dir)
}

// LoadFromData loads a pack from raw JSON manifest data.
func (l *Loader) LoadFromData(data []byte, sourceDir string) (*LoadedPack, error) {
	manifest, result, err := ParseManifest(data)
	if err != nil {
		return &LoadedPack{
			SourceDir: sourceDir,
			Disabled:  true,
			Error:     fmt.Sprintf("parse error: %v", err),
		}, nil
	}

	if !result.Valid {
		errMsg := "validation failed:"
		for _, e := range result.Errors {
			errMsg += fmt.Sprintf(" [%s: %s]", e.Field, e.Message)
		}
		return &LoadedPack{
			Manifest:  manifest,
			SourceDir: sourceDir,
			Hash:      result.Hash,
			Disabled:  true,
			Error:     errMsg,
		}, nil
	}

	// Verify integrity if signature is present
	if manifest.SignatureHash != "" {
		if err := VerifyIntegrity(manifest); err != nil {
			return &LoadedPack{
				Manifest:  manifest,
				SourceDir: sourceDir,
				Hash:      result.Hash,
				Disabled:  true,
				Error:     fmt.Sprintf("integrity check failed: %v", err),
			}, nil
		}
	}

	return &LoadedPack{
		Manifest:  manifest,
		Hash:      result.Hash,
		SourceDir: sourceDir,
		Disabled:  false,
	}, nil
}

// LoadAll discovers and loads all packs from search directories.
// Returns packs in deterministic topological order.
func (l *Loader) LoadAll() ([]*LoadedPack, error) {
	paths, err := l.DiscoverPacks()
	if err != nil {
		return nil, err
	}

	// Load all manifests first
	loaded := make([]*LoadedPack, 0, len(paths))
	byID := make(map[string]*LoadedPack)

	for _, path := range paths {
		pack, err := l.LoadFromDir(path)
		if err != nil {
			// Containment: record error, don't fail everything
			loaded = append(loaded, &LoadedPack{
				SourceDir: path,
				Disabled:  true,
				Error:     err.Error(),
			})
			continue
		}
		loaded = append(loaded, pack)
		if pack.Manifest != nil && !pack.Disabled {
			byID[pack.Manifest.Metadata.ID] = pack
		}
	}

	// Resolve topological order
	order, err := resolveLoadOrder(byID)
	if err != nil {
		return nil, fmt.Errorf("dependency resolution failed: %w", err)
	}

	// Register in order
	l.mu.Lock()
	defer l.mu.Unlock()

	l.loadOrder = order
	for _, pack := range loaded {
		if pack.Manifest != nil {
			l.packs[pack.Manifest.Metadata.ID] = pack
		}
	}

	// Return in topological order, with disabled packs at the end
	ordered := make([]*LoadedPack, 0, len(loaded))
	for _, id := range order {
		if p, ok := l.packs[id]; ok {
			ordered = append(ordered, p)
		}
	}
	for _, p := range loaded {
		if p.Disabled {
			ordered = append(ordered, p)
		}
	}

	return ordered, nil
}

// Get returns a loaded pack by ID.
func (l *Loader) Get(id string) (*LoadedPack, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	p, ok := l.packs[id]
	return p, ok
}

// List returns all loaded pack IDs in load order.
func (l *Loader) List() []string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	out := make([]string, len(l.loadOrder))
	copy(out, l.loadOrder)
	return out
}

// Register adds a pre-loaded pack to the loader.
func (l *Loader) Register(pack *LoadedPack) error {
	if pack.Manifest == nil {
		return fmt.Errorf("cannot register pack without manifest")
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	id := pack.Manifest.Metadata.ID
	l.packs[id] = pack
	l.loadOrder = append(l.loadOrder, id)
	return nil
}

// Unregister removes a pack from the loader.
func (l *Loader) Unregister(id string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	delete(l.packs, id)
	newOrder := make([]string, 0, len(l.loadOrder))
	for _, oid := range l.loadOrder {
		if oid != id {
			newOrder = append(newOrder, oid)
		}
	}
	l.loadOrder = newOrder
}

// Snapshot returns a JSON-serializable snapshot of all loaded packs.
func (l *Loader) Snapshot() ([]byte, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	type snapshot struct {
		LoadOrder []string      `json:"load_order"`
		Packs     []*LoadedPack `json:"packs"`
	}

	packs := make([]*LoadedPack, 0, len(l.loadOrder))
	for _, id := range l.loadOrder {
		if p, ok := l.packs[id]; ok {
			packs = append(packs, p)
		}
	}

	return json.Marshal(snapshot{
		LoadOrder: l.loadOrder,
		Packs:     packs,
	})
}

// resolveLoadOrder computes a deterministic topological order for packs
// based on their declared dependencies.
func resolveLoadOrder(packs map[string]*LoadedPack) ([]string, error) {
	// Build adjacency list
	adj := make(map[string][]string)
	inDegree := make(map[string]int)

	for id := range packs {
		if _, ok := inDegree[id]; !ok {
			inDegree[id] = 0
		}
	}

	for id, pack := range packs {
		for _, dep := range pack.Manifest.Dependencies {
			if _, exists := packs[dep.ID]; !exists {
				if !dep.Optional {
					return nil, fmt.Errorf("pack %s depends on %s which is not loaded", id, dep.ID)
				}
				continue
			}
			adj[dep.ID] = append(adj[dep.ID], id)
			inDegree[id]++
		}
	}

	// Kahn's algorithm with deterministic tie-breaking (alphabetical)
	var queue []string
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}
	sort.Strings(queue)

	var order []string
	for len(queue) > 0 {
		// Pop first (deterministic due to sorting)
		u := queue[0]
		queue = queue[1:]
		order = append(order, u)

		// Sort neighbors for determinism
		neighbors := adj[u]
		sort.Strings(neighbors)
		for _, v := range neighbors {
			inDegree[v]--
			if inDegree[v] == 0 {
				queue = append(queue, v)
				sort.Strings(queue)
			}
		}
	}

	if len(order) != len(packs) {
		return nil, fmt.Errorf("circular dependency detected among packs")
	}

	return order, nil
}
