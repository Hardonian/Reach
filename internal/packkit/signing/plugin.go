// Package signing provides cryptographic signing interfaces for Reach.
//
// The signing layer defines a plugin interface that allows external signer
// implementations while keeping the core lightweight (no heavy crypto libs).
//
// Key concepts:
//   - SignerPlugin: Interface for external signer implementations
//   - Core records signature metadata only, not cryptographic operations
//   - Built-in plugins: NoOpSigner (testing), FileKeySigner (development)
package signing

import (
	"errors"
	"fmt"
)

// Algorithm represents a signing algorithm.
type Algorithm string

const (
	// AlgorithmEd25519 is the Ed25519 signature algorithm.
	AlgorithmEd25519 Algorithm = "ed25519"
	// AlgorithmRSA is the RSA-SHA256 signature algorithm.
	AlgorithmRSA Algorithm = "rsa-sha256"
	// AlgorithmECDSA is the ECDSA signature algorithm.
	AlgorithmECDSA Algorithm = "ecdsa"
	// AlgorithmNoOp is the no-operation algorithm (for testing).
	AlgorithmNoOp Algorithm = "noop"
)

// SignerPlugin defines the interface for external signer plugins.
//
// Implementations must be deterministic - the same input must always
// produce the same output. This is critical for replay verification.
type SignerPlugin interface {
	// Name returns the name of the signer plugin.
	Name() string

	// SupportedAlgorithms returns the list of algorithms this signer supports.
	SupportedAlgorithms() []Algorithm

	// Sign signs the given data with the specified algorithm.
	// Returns the signature or an error.
	Sign(data []byte, algorithm string) ([]byte, error)

	// Verify verifies the signature over the given data.
	// Returns true if the signature is valid, false otherwise.
	// Returns an error if verification cannot be performed.
	Verify(data []byte, signature []byte, algorithm string) (bool, error)
}

// SignerPluginFactory creates a SignerPlugin from configuration.
type SignerPluginFactory func(config map[string]string) (SignerPlugin, error)

// Registry holds the registered signer plugins.
type Registry struct {
	plugins    map[string]SignerPlugin
	factories  map[string]SignerPluginFactory
	defaultKey string
}

// NewRegistry creates a new signer registry.
func NewRegistry() *Registry {
	return &Registry{
		plugins:   make(map[string]SignerPlugin),
		factories: make(map[string]SignerPluginFactory),
	}
}

// Register adds a named plugin to the registry.
func (r *Registry) Register(name string, plugin SignerPlugin) error {
	if name == "" {
		return errors.New("signing: plugin name cannot be empty")
	}
	if plugin == nil {
		return errors.New("signing: plugin cannot be nil")
	}
	r.plugins[name] = plugin
	return nil
}

// RegisterFactory registers a factory function for lazy plugin creation.
func (r *Registry) RegisterFactory(name string, factory SignerPluginFactory) error {
	if name == "" {
		return errors.New("signing: factory name cannot be empty")
	}
	if factory == nil {
		return errors.New("signing: factory cannot be nil")
	}
	r.factories[name] = factory
	return nil
}

// Get returns a plugin by name.
func (r *Registry) Get(name string) (SignerPlugin, error) {
	if plugin, ok := r.plugins[name]; ok {
		return plugin, nil
	}
	if factory, ok := r.factories[name]; ok {
		plugin, err := factory(nil)
		if err != nil {
			return nil, err
		}
		r.plugins[name] = plugin
		return plugin, nil
	}
	return nil, fmt.Errorf("signing: unknown plugin: %s", name)
}

// SetDefault sets the default plugin by name.
func (r *Registry) SetDefault(name string) error {
	if _, err := r.Get(name); err != nil {
		return err
	}
	r.defaultKey = name
	return nil
}

// GetDefault returns the default plugin.
func (r *Registry) GetDefault() (SignerPlugin, error) {
	if r.defaultKey == "" {
		return nil, errors.New("signing: no default plugin set")
	}
	return r.Get(r.defaultKey)
}

// List returns all registered plugin names.
func (r *Registry) List() []string {
	names := make([]string, 0, len(r.plugins)+len(r.factories))
	for name := range r.plugins {
		names = append(names, name)
	}
	for name := range r.factories {
		// Skip if already in plugins (lazy-loaded)
		if _, ok := r.plugins[name]; !ok {
			names = append(names, name)
		}
	}
	return names
}

// GlobalRegistry is the default registry for all signer plugins.
var GlobalRegistry = NewRegistry()

func init() {
	// Register built-in plugins
	_ = GlobalRegistry.Register("noop", NewNoOpSigner())
	_ = GlobalRegistry.RegisterFactory("file", NewFileKeySigner)
	_ = GlobalRegistry.SetDefault("noop")
}

// RegisterBuiltInPlugins is kept for backward compatibility.
// It no-ops since plugins are registered in init().
func RegisterBuiltInPlugins() error {
	return nil
}
