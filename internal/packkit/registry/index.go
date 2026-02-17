package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type PackageRef struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Manifest string `json:"manifest"`
	Sig      string `json:"sig"`
	Bundle   string `json:"bundle"`
	Hash     string `json:"hash"`
}

type Index struct {
	Packages []PackageRef `json:"packages"`
}

func RegistryIndexRead(path string) (Index, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return Index{}, fmt.Errorf("read index: %w", err)
	}
	var idx Index
	if err := json.Unmarshal(data, &idx); err != nil {
		return Index{}, fmt.Errorf("parse index: %w", err)
	}
	return idx, nil
}
