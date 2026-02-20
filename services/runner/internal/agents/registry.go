package agents

import (
	"fmt"
	"sync"
)

// Registry is a concurrent-safe registry of agent specs and handlers.
// It provides lookup and enumeration capabilities for the runtime.
type Registry struct {
	mu       sync.RWMutex
	agents   map[AgentID]registeredAgent
	runtime  *Runtime
}

type registeredAgent struct {
	spec    AgentSpec
	handler Handler
}

// NewRegistry creates a new agent registry bound to a runtime.
func NewRegistry(rt *Runtime) *Registry {
	return &Registry{
		agents:  make(map[AgentID]registeredAgent),
		runtime: rt,
	}
}

// Register adds an agent to the registry and the runtime.
func (r *Registry) Register(spec AgentSpec, handler Handler) error {
	if err := spec.Validate(); err != nil {
		return fmt.Errorf("agents/registry: %w", err)
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.agents[spec.ID]; exists {
		return fmt.Errorf("agents/registry: agent %s already registered", spec.ID)
	}

	if err := r.runtime.Register(spec, handler); err != nil {
		return fmt.Errorf("agents/registry: runtime registration failed: %w", err)
	}

	r.agents[spec.ID] = registeredAgent{spec: spec, handler: handler}
	return nil
}

// Unregister removes an agent from the registry and runtime.
func (r *Registry) Unregister(id AgentID) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.agents, id)
	r.runtime.Unregister(id)
}

// Get returns the spec for a registered agent.
func (r *Registry) Get(id AgentID) (AgentSpec, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agent, ok := r.agents[id]
	if !ok {
		return AgentSpec{}, false
	}
	return agent.spec, true
}

// List returns all registered agent specs.
func (r *Registry) List() []AgentSpec {
	r.mu.RLock()
	defer r.mu.RUnlock()

	specs := make([]AgentSpec, 0, len(r.agents))
	for _, agent := range r.agents {
		specs = append(specs, agent.spec)
	}
	return specs
}

// Count returns the number of registered agents.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.agents)
}

// Has returns true if an agent is registered.
func (r *Registry) Has(id AgentID) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.agents[id]
	return ok
}
