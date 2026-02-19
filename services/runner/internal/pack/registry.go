package pack

import (
	"sync"
)

// PackRegistry provides a content-addressed store for validated execution packs.
type PackRegistry struct {
	mu    sync.RWMutex
	packs map[string]*LintResult // CID (Hash) -> Result
}

// NewPackRegistry creates a new instance of PackRegistry.
func NewPackRegistry() *PackRegistry {
	return &PackRegistry{
		packs: make(map[string]*LintResult),
	}
}

// Register adds a validated pack result to the registry.
func (r *PackRegistry) Register(res *LintResult) string {
	if res == nil || res.Hash == "" || !res.Valid {
		return ""
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.packs[res.Hash] = res
	return res.Hash
}

// Get retrieves a pack result by its CID (Hash).
func (r *PackRegistry) Get(cid string) (*LintResult, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	res, ok := r.packs[cid]
	return res, ok
}

// ListCIDs returns all registered CIDs.
func (r *PackRegistry) ListCIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cids := make([]string, 0, len(r.packs))
	for k := range r.packs {
		cids = append(cids, k)
	}
	return cids
}
