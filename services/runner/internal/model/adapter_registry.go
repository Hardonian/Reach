// Package model provides adapter registration and selection.
package model

import (
	"context"
	"fmt"
	"sync"
)

// AdapterFactory creates provider adapters.
type AdapterFactory func(config ProviderConfig) (Provider, error)

// Registry manages provider adapters and enables fallback chains.
type Registry struct {
	mu        sync.RWMutex
	adapters  map[string]Provider
	factories map[string]AdapterFactory
	fallbacks map[string][]string // provider -> fallback chain
	defaultID string
}

// NewRegistry creates a new adapter registry.
func NewRegistry() *Registry {
	return &Registry{
		adapters:  make(map[string]Provider),
		factories: make(map[string]AdapterFactory),
		fallbacks: make(map[string][]string),
	}
}

// Register adds a provider adapter to the registry.
func (r *Registry) Register(id string, adapter Provider) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if id == "" {
		return fmt.Errorf("provider ID cannot be empty")
	}
	if adapter == nil {
		return fmt.Errorf("cannot register nil adapter for %q", id)
	}
	if _, exists := r.adapters[id]; exists {
		return fmt.Errorf("adapter %q already registered", id)
	}

	r.adapters[id] = adapter
	return nil
}

// RegisterFactory adds an adapter factory for lazy initialization.
func (r *Registry) RegisterFactory(id string, factory AdapterFactory) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if id == "" {
		return fmt.Errorf("provider ID cannot be empty")
	}
	if factory == nil {
		return fmt.Errorf("cannot register nil factory for %q", id)
	}

	r.factories[id] = factory
	return nil
}

// SetDefault marks a provider as the default.
func (r *Registry) SetDefault(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.adapters[id]; !exists {
		// Check if factory exists for lazy init
		if _, factoryExists := r.factories[id]; !factoryExists {
			return fmt.Errorf("provider %q not found", id)
		}
	}

	r.defaultID = id
	return nil
}

// SetFallbackChain configures fallback providers for a given provider.
// When the primary provider fails, the registry will try fallbacks in order.
func (r *Registry) SetFallbackChain(primary string, fallbacks ...string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Validate all providers exist
	for _, id := range append([]string{primary}, fallbacks...) {
		if _, exists := r.adapters[id]; !exists {
			if _, factoryExists := r.factories[id]; !factoryExists {
				return fmt.Errorf("provider %q not found", id)
			}
		}
	}

	r.fallbacks[primary] = fallbacks
	return nil
}

// Get retrieves a provider by ID.
// Returns the default provider if id is empty.
func (r *Registry) Get(id string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if id == "" {
		id = r.defaultID
		if id == "" {
			return nil, fmt.Errorf("no default provider set and no ID specified")
		}
	}

	// Return existing adapter
	if adapter, exists := r.adapters[id]; exists {
		return adapter, nil
	}

	// Try lazy initialization
	if factory, exists := r.factories[id]; exists {
		r.mu.RUnlock()
		adapter, err := factory(ProviderConfig{})
		r.mu.RLock()
		if err != nil {
			return nil, fmt.Errorf("failed to initialize provider %q: %w", id, err)
		}
		r.adapters[id] = adapter
		return adapter, nil
	}

	return nil, fmt.Errorf("provider %q not found", id)
}

// GetWithFallback retrieves a provider with fallback support.
// Returns the primary provider if healthy, otherwise tries fallbacks.
func (r *Registry) GetWithFallback(ctx context.Context, id string) (Provider, error) {
	primary, err := r.Get(id)
	if err != nil {
		return nil, err
	}

	// Check if primary is available
	if r.isHealthy(ctx, primary) {
		return primary, nil
	}

	// Try fallbacks
	r.mu.RLock()
	fallbacks, hasFallbacks := r.fallbacks[id]
	r.mu.RUnlock()

	if hasFallbacks {
		for _, fallbackID := range fallbacks {
			fallback, err := r.Get(fallbackID)
			if err != nil {
				continue
			}
			if r.isHealthy(ctx, fallback) {
				return fallback, nil
			}
		}
	}

	// Return primary anyway if no fallbacks worked
	return primary, nil
}

// isHealthy checks if a provider is available.
func (r *Registry) isHealthy(ctx context.Context, p Provider) bool {
	// Use GetCapabilities as a lightweight health check
	// Providers should implement proper health checking
	caps := p.GetCapabilities()
	return caps.MaxContextTokens > 0
}

// List returns all registered provider IDs.
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]string, 0, len(r.adapters)+len(r.factories))
	for id := range r.adapters {
		ids = append(ids, id)
	}
	for id := range r.factories {
		// Only add if not already instantiated
		if _, exists := r.adapters[id]; !exists {
			ids = append(ids, id)
		}
	}
	return ids
}

// ListAvailable returns providers that are currently available.
func (r *Registry) ListAvailable(ctx context.Context) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	available := make([]string, 0)
	for id, adapter := range r.adapters {
		if r.isHealthy(ctx, adapter) {
			available = append(available, id)
		}
	}
	return available
}

// Unregister removes a provider from the registry.
func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.adapters, id)
	delete(r.factories, id)
	delete(r.fallbacks, id)

	if r.defaultID == id {
		r.defaultID = ""
	}
}

// InitializeAll eagerly initializes all providers with factories.
func (r *Registry) InitializeAll(configs map[string]ProviderConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for id, factory := range r.factories {
		if _, exists := r.adapters[id]; exists {
			continue // Already initialized
		}

		config, hasConfig := configs[id]
		if !hasConfig {
			config = ProviderConfig{}
		}

		r.mu.Unlock()
		adapter, err := factory(config)
		r.mu.Lock()

		if err != nil {
			// Log but don't fail - some providers may be optional
			continue
		}

		r.adapters[id] = adapter
	}

	return nil
}

// Global registry instance.
var globalRegistry = NewRegistry()

// RegisterGlobal registers a provider on the global registry.
func RegisterGlobal(id string, adapter Provider) error {
	return globalRegistry.Register(id, adapter)
}

// GetGlobal retrieves a provider from the global registry.
func GetGlobal(id string) (Provider, error) {
	return globalRegistry.Get(id)
}

// SetDefaultGlobal sets the default provider on the global registry.
func SetDefaultGlobal(id string) error {
	return globalRegistry.SetDefault(id)
}
