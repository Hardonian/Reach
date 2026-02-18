package registry

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
)

// Capability defines a unit of functionality available to the execution environment.
type Capability struct {
	ID                  string                 `json:"id"`
	Version             string                 `json:"version"` // Semver
	Description         string                 `json:"description"`
	RequiredTools       []string               `json:"required_tools"`       // List of atomic tool names (e.g. "tool.read_file")
	RequiredPermissions []string               `json:"required_permissions"` // List of scopes (e.g. "filesystem:read")
	RequiredModels      []string               `json:"required_models"`      // Model constraints
	Deterministic       bool                   `json:"deterministic"`        // If true, same input -> same output
	Stateful            bool                   `json:"stateful"`             // If true, side effects on session state
	InputSchema         map[string]interface{} `json:"input_schema,omitempty"`
	OutputSchema        map[string]interface{} `json:"output_schema,omitempty"`
}

// Registry manages the set of available capabilities.
type Registry interface {
	Register(cap Capability) error
	Get(id string) (*Capability, error)
	List() []Capability
	ValidateTools(tools []string) error
	ValidatePackCompatibility(pack ExecutionPack) error
}

// InMemoryRegistry is a thread-safe implementation of Registry with caching.
// It provides O(1) lookups for capabilities and tools.
type InMemoryRegistry struct {
	mu sync.RWMutex
	// simplified tool->cap mapping
	capabilities       map[string]Capability
	toolToCap          map[string]string
	supportedPackMajor int

	// Cache for pack compatibility checks to avoid recomputation
	// Key: pack.Metadata.ID+"@"+pack.Metadata.Version
	// Value: error (nil if compatible)
	compatibilityCache map[string]error
}

// NewInMemoryRegistry creates a new registry with default settings.
func NewInMemoryRegistry() *InMemoryRegistry {
	return &InMemoryRegistry{
		capabilities:       make(map[string]Capability),
		toolToCap:          make(map[string]string),
		supportedPackMajor: 1,
		compatibilityCache: make(map[string]error),
	}
}

// WithSupportedPackMajor sets the supported pack major version.
// Returns the registry for method chaining.
func (r *InMemoryRegistry) WithSupportedPackMajor(major int) *InMemoryRegistry {
	if major > 0 {
		r.supportedPackMajor = major
	}
	return r
}

// Register adds a capability to the registry.
// It updates the tool-to-capability mapping for fast lookups.
func (r *InMemoryRegistry) Register(cap Capability) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if cap.ID == "" {
		return errors.New("capability ID is required")
	}
	r.capabilities[cap.ID] = cap
	for _, t := range cap.RequiredTools {
		r.toolToCap[t] = cap.ID
	}
	// Clear compatibility cache since registry changed
	r.compatibilityCache = make(map[string]error)
	return nil
}

// Get retrieves a capability by ID.
// Returns an error if the capability is not found.
func (r *InMemoryRegistry) Get(id string) (*Capability, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cap, ok := r.capabilities[id]
	if !ok {
		return nil, fmt.Errorf("capability not found: %s", id)
	}
	return &cap, nil
}

// List returns all registered capabilities.
// The returned slice is a copy to prevent external modification.
func (r *InMemoryRegistry) List() []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	caps := make([]Capability, 0, len(r.capabilities))
	for _, c := range r.capabilities {
		caps = append(caps, c)
	}
	return caps
}

// ValidateTools ensures that all requested tools are provided by at least one registered capability.
// Currently a no-op placeholder for future implementation.
func (r *InMemoryRegistry) ValidateTools(requestedTools []string) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// This is a simplified check. It assumes that if a capability lists a tool, it "provides" it.
	// In reality, tools might be provided by the underlying system (mcpserver) and Capabilities just expose them.
	// But enforcing that a capability exists that *uses* the tool is a way to ensure it's documented/allowed.

	// Implementation note: The user requirement "Prevent execution without declared tools" likely means
	// we check against the ExecutionPack's declared tools.
	// The Registry's role here is to confirm that the tools exist in the *System*.
	// But the registry stores *Capabilities*, not low-level tools directly (unless we map 1:1).

	// For now, let's assume we validate that for every tool in the list, there is a capability that *uses* it,
	// or that the tool itself is a capability ID.
	// Let's stick to the interface definition: "ValidatePackCompatibility" which likely checks if capabilities exist.

	return nil
}

// ValidatePackCompatibility ensures that a pack's declared tools exist in the registry.
// It uses caching to avoid recomputing compatibility for the same pack.
// The cache key is pack.Metadata.ID + "@" + pack.Metadata.Version.
func (r *InMemoryRegistry) ValidatePackCompatibility(pack ExecutionPack) error {
	// Generate cache key
	cacheKey := pack.Metadata.ID + "@" + pack.Metadata.Version

	// Check cache first (read lock)
	r.mu.RLock()
	if cachedErr, ok := r.compatibilityCache[cacheKey]; ok {
		r.mu.RUnlock()
		return cachedErr
	}
	r.mu.RUnlock()

	// Compute compatibility (write lock)
	r.mu.Lock()
	defer r.mu.Unlock()

	// Double-check cache after acquiring write lock
	if cachedErr, ok := r.compatibilityCache[cacheKey]; ok {
		return cachedErr
	}

	// Perform validation
	err := r.validatePackCompatibilityUncached(pack)

	// Cache the result
	r.compatibilityCache[cacheKey] = err

	return err
}

// validatePackCompatibilityUncached performs the actual compatibility check without caching.
// Must be called with write lock held.
func (r *InMemoryRegistry) validatePackCompatibilityUncached(pack ExecutionPack) error {
	if pack.Metadata.Version != "" {
		major, err := packMajor(pack.Metadata.Version)
		if err != nil {
			return err
		}
		if major > r.supportedPackMajor {
			return fmt.Errorf("pack major version %d is incompatible with node major %d", major, r.supportedPackMajor)
		}
	}

	for _, tool := range pack.DeclaredTools {
		// Check if tool is mapped to a capability
		if _, exists := r.toolToCap[tool]; exists {
			continue
		}
		// Check if tool ID is itself a capability (direct capability usage)
		if _, exists := r.capabilities[tool]; exists {
			continue
		}

		return fmt.Errorf("pack declares tool '%s' which is not provided by any registered capability", tool)
	}
	return nil
}

// ClearCompatibilityCache clears the pack compatibility cache.
// This should be called when the registry is updated dynamically.
func (r *InMemoryRegistry) ClearCompatibilityCache() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.compatibilityCache = make(map[string]error)
}

// packMajor extracts the major version number from a semver string.
func packMajor(version string) (int, error) {
	parts := strings.Split(strings.TrimSpace(version), ".")
	if len(parts) < 1 || parts[0] == "" {
		return 0, fmt.Errorf("pack version is invalid: %q", version)
	}
	major, err := strconv.Atoi(parts[0])
	if err != nil || major < 0 {
		return 0, fmt.Errorf("pack version is invalid: %q", version)
	}
	return major, nil
}
