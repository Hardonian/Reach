// Package plugins implements the plugin packaging system for Reach.
// Plugins are optional extensions that add functionality.
package plugins

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
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

// Determinism