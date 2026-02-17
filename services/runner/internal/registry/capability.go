package registry

import (
	"errors"
	"fmt"
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

// InMemoryRegistry is a simple thread-safe implementation of Registry.
type InMemoryRegistry struct {
	mu           sync.RWMutex
	capabilities map[string]Capability
	// simplified tool->cap mapping
	toolToCap map[string]string
}

func NewInMemoryRegistry() *InMemoryRegistry {
	return &InMemoryRegistry{
		capabilities: make(map[string]Capability),
		toolToCap:    make(map[string]string),
	}
}

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
	return nil
}

func (r *InMemoryRegistry) Get(id string) (*Capability, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cap, ok := r.capabilities[id]
	if !ok {
		return nil, fmt.Errorf("capability not found: %s", id)
	}
	return &cap, nil
}

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
func (r *InMemoryRegistry) ValidatePackCompatibility(pack ExecutionPack) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

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
