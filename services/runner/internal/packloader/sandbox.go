package packloader

import (
	"context"
	"fmt"
	"sync"
)

// PackNamespace provides logical isolation for a loaded pack.
// Each pack gets its own namespace that prevents cross-pack mutation
// and global state bleed.
type PackNamespace struct {
	PackID  string
	version string
	state   map[string]any
	exports map[string]any
	mu      sync.RWMutex
	sealed  bool // once sealed, no new state keys can be added
}

// NewPackNamespace creates an isolated namespace for a pack.
func NewPackNamespace(packID, version string) *PackNamespace {
	return &PackNamespace{
		PackID:  packID,
		version: version,
		state:   make(map[string]any),
		exports: make(map[string]any),
	}
}

// Set stores a value in the pack's isolated state.
// Returns an error if the namespace is sealed and the key is new.
func (ns *PackNamespace) Set(key string, value any) error {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	if ns.sealed {
		if _, exists := ns.state[key]; !exists {
			return fmt.Errorf("namespace sealed: cannot add new key %q in pack %s", key, ns.PackID)
		}
	}
	ns.state[key] = value
	return nil
}

// Get retrieves a value from the pack's isolated state.
func (ns *PackNamespace) Get(key string) (any, bool) {
	ns.mu.RLock()
	defer ns.mu.RUnlock()
	v, ok := ns.state[key]
	return v, ok
}

// Export registers a value that other packs can read (but not modify).
func (ns *PackNamespace) Export(key string, value any) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.exports[key] = value
}

// GetExport reads an exported value.
func (ns *PackNamespace) GetExport(key string) (any, bool) {
	ns.mu.RLock()
	defer ns.mu.RUnlock()
	v, ok := ns.exports[key]
	return v, ok
}

// Seal prevents new state keys from being added.
func (ns *PackNamespace) Seal() {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.sealed = true
}

// PackSandbox enforces capability-based access control for a pack at runtime.
// It wraps each pack execution with tool and permission checks, preventing
// any undeclared access.
type PackSandbox struct {
	mu         sync.RWMutex
	namespaces map[string]*PackNamespace // pack ID -> namespace
	manifests  map[string]*PackManifest  // pack ID -> manifest (for access control)
	auditLog   []AuditEntry
	auditSink  func(AuditEntry)
}

// AuditEntry records a sandbox enforcement decision.
type AuditEntry struct {
	PackID  string `json:"pack_id"`
	Action  string `json:"action"`
	Target  string `json:"target"`
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

// NewPackSandbox creates a new sandbox manager.
func NewPackSandbox() *PackSandbox {
	return &PackSandbox{
		namespaces: make(map[string]*PackNamespace),
		manifests:  make(map[string]*PackManifest),
	}
}

// SetAuditSink sets a callback for audit events.
func (s *PackSandbox) SetAuditSink(sink func(AuditEntry)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.auditSink = sink
}

// RegisterPack creates an isolated namespace for a pack and stores its
// manifest for access control enforcement.
func (s *PackSandbox) RegisterPack(pack *LoadedPack) error {
	if pack.Manifest == nil {
		return fmt.Errorf("cannot register pack without manifest")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := pack.Manifest.Metadata.ID
	s.namespaces[id] = NewPackNamespace(id, pack.Manifest.Metadata.Version)
	s.manifests[id] = pack.Manifest
	return nil
}

// UnregisterPack removes a pack's namespace and manifest.
func (s *PackSandbox) UnregisterPack(packID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.namespaces, packID)
	delete(s.manifests, packID)
}

// CheckToolAccess verifies that a pack is allowed to use a specific tool.
func (s *PackSandbox) CheckToolAccess(packID, toolName string) error {
	s.mu.RLock()
	manifest, ok := s.manifests[packID]
	s.mu.RUnlock()

	if !ok {
		entry := AuditEntry{PackID: packID, Action: "tool_call", Target: toolName, Allowed: false, Reason: "pack not registered"}
		s.audit(entry)
		return fmt.Errorf("pack %s is not registered in sandbox", packID)
	}

	for _, t := range manifest.DeclaredTools {
		if t == toolName {
			entry := AuditEntry{PackID: packID, Action: "tool_call", Target: toolName, Allowed: true}
			s.audit(entry)
			return nil
		}
	}

	entry := AuditEntry{PackID: packID, Action: "tool_call", Target: toolName, Allowed: false, Reason: "tool not declared"}
	s.audit(entry)
	return fmt.Errorf("tool %s not declared in pack %s", toolName, packID)
}

// CheckPermission verifies that a pack has a specific permission.
func (s *PackSandbox) CheckPermission(packID, permission string) error {
	s.mu.RLock()
	manifest, ok := s.manifests[packID]
	s.mu.RUnlock()

	if !ok {
		entry := AuditEntry{PackID: packID, Action: "permission_check", Target: permission, Allowed: false, Reason: "pack not registered"}
		s.audit(entry)
		return fmt.Errorf("pack %s is not registered in sandbox", packID)
	}

	for _, p := range manifest.DeclaredPermissions {
		if p == permission {
			entry := AuditEntry{PackID: packID, Action: "permission_check", Target: permission, Allowed: true}
			s.audit(entry)
			return nil
		}
	}

	entry := AuditEntry{PackID: packID, Action: "permission_check", Target: permission, Allowed: false, Reason: "permission not declared"}
	s.audit(entry)
	return fmt.Errorf("permission %s not declared in pack %s", permission, packID)
}

// GetNamespace returns the isolated namespace for a pack.
func (s *PackSandbox) GetNamespace(packID string) (*PackNamespace, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ns, ok := s.namespaces[packID]
	if !ok {
		return nil, fmt.Errorf("no namespace for pack %s", packID)
	}
	return ns, nil
}

// ReadExport allows a pack to read an exported value from another pack,
// but only if the target pack actually exports it.
func (s *PackSandbox) ReadExport(readerPackID, targetPackID, key string) (any, error) {
	// Read-lock to look up namespace and manifest, then release before audit.
	s.mu.RLock()
	targetNS, nsOk := s.namespaces[targetPackID]
	targetManifest, mOk := s.manifests[targetPackID]
	s.mu.RUnlock()

	if !nsOk {
		return nil, fmt.Errorf("target pack %s is not registered", targetPackID)
	}
	if !mOk {
		return nil, fmt.Errorf("target pack %s has no manifest", targetPackID)
	}

	// Check if the target pack declares this key as an export
	exported := false
	for _, exp := range targetManifest.Exports {
		if exp == key {
			exported = true
			break
		}
	}
	if !exported {
		entry := AuditEntry{
			PackID:  readerPackID,
			Action:  "read_export",
			Target:  fmt.Sprintf("%s.%s", targetPackID, key),
			Allowed: false,
			Reason:  "not in exports list",
		}
		s.audit(entry)
		return nil, fmt.Errorf("pack %s does not export %s", targetPackID, key)
	}

	val, ok := targetNS.GetExport(key)
	if !ok {
		return nil, fmt.Errorf("export %s not set in pack %s", key, targetPackID)
	}

	entry := AuditEntry{
		PackID:  readerPackID,
		Action:  "read_export",
		Target:  fmt.Sprintf("%s.%s", targetPackID, key),
		Allowed: true,
	}
	s.audit(entry)
	return val, nil
}

// EnforcedCall wraps a function call with sandbox enforcement.
// It checks tool access before executing and records audit events.
func (s *PackSandbox) EnforcedCall(ctx context.Context, packID, toolName string, fn func(context.Context) (any, error)) (any, error) {
	if err := s.CheckToolAccess(packID, toolName); err != nil {
		return nil, err
	}
	return fn(ctx)
}

// AuditLog returns a copy of the audit log.
func (s *PackSandbox) AuditLog() []AuditEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]AuditEntry, len(s.auditLog))
	copy(out, s.auditLog)
	return out
}

func (s *PackSandbox) audit(entry AuditEntry) {
	s.mu.Lock()
	s.auditLog = append(s.auditLog, entry)
	sink := s.auditSink
	s.mu.Unlock()

	if sink != nil {
		sink(entry)
	}
}
