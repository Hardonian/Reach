package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type PackageVersion struct {
	Version        string `json:"version"`
	SHA256         string `json:"sha256"`
	ManifestURL    string `json:"manifest_url"`
	BundleURL      string `json:"bundle_url"`
	SignatureURL   string `json:"signature_url,omitempty"`
	SignatureKeyID string `json:"signature_key_id"`
	RiskLevel      string `json:"risk_level"`
	TierRequired   string `json:"tier_required"`
}

type Package struct {
	ID       string           `json:"id"`
	Versions []PackageVersion `json:"versions"`
}

type Index struct {
	Packages []Package `json:"packages"`
}

func RegistryIndexRead(path string) (Index, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return Index{}, fmt.Errorf("read index: %w", err)
	}
	return ParseIndex(data)
}

func ParseIndex(data []byte) (Index, error) {
	var idx Index
	if err := json.Unmarshal(data, &idx); err != nil {
		return Index{}, fmt.Errorf("parse index: %w", err)
	}
	if err := ValidateIndex(idx); err != nil {
		return Index{}, err
	}
	return idx, nil
}

func ValidateIndex(idx Index) error {
	if len(idx.Packages) == 0 {
		return fmt.Errorf("index packages required")
	}
	for _, p := range idx.Packages {
		if p.ID == "" {
			return fmt.Errorf("package id required")
		}
		if len(p.Versions) == 0 {
			return fmt.Errorf("package %s requires at least one version", p.ID)
		}
		for _, v := range p.Versions {
			if v.Version == "" || v.SHA256 == "" || v.ManifestURL == "" || v.BundleURL == "" || v.SignatureKeyID == "" || v.RiskLevel == "" || v.TierRequired == "" {
				return fmt.Errorf("package %s version entry has missing required fields", p.ID)
			}
		}
	}
	return nil
}
