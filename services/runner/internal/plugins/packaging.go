// Package plugins implements the plugin packaging system for Reach.
// Plugins are optional extensions that add functionality.
package plugins

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
)

// PluginManifest defines plugin metadata.
type PluginManifest struct {
	Name              string               `json:"name"`
	Version           string               `json:"version"`
	Description       string               `json:"description"`
	Type              string               `json:"type"`
	Compatibility    string               `json:"compatibility"`
	Entrypoints      []string             `json:"entrypoints"`
	Permissions      []string             `json:"permissions"`
	DeterminismContract DeterminismContract `json:"determinism_contract"`
	Author           string               `json:"author,omitempty"`
	License          string               `json:"license,omitempty"`
}

// DeterminismContract specifies how a plugin maintains determinism.
type DeterminismContract struct {
	StableOutputs     bool     `json:"stable_outputs"`
	NoRandomness      bool     `json:"no_randomness"`
	NoExternalCalls   bool     `json:"no_external_calls"`
	VersionCheck      string   `json:"version_check,omitempty"`
	RequiredChecksums []string `json:"required_checksums,omitempty"`
}

// Validate checks if the plugin manifest is valid.
func (m *PluginManifest) Validate() error {
	if m.Name == "" {
		return fmt.Errorf("plugin name is required")
	}
	if m.Version == "" {
		return fmt.Errorf("plugin version is required")
	}
	if m.Type == "" {
		return fmt.Errorf("plugin type is required")
	}
	return nil
}

// Hash computes a deterministic hash of the plugin manifest.
func (m *PluginManifest) Hash() string {
	data, _ := json.Marshal(m)
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h[:])
}