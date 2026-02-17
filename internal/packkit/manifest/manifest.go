package manifest

import (
	"encoding/json"
	"fmt"
)

type Manifest struct {
	Kind                 string   `json:"kind"`
	ID                   string   `json:"id"`
	Version              string   `json:"version"`
	PackageHash          string   `json:"package_hash"`
	RequiredCapabilities []string `json:"required_capabilities"`
	SideEffectTypes      []string `json:"side_effect_types"`
	RiskLevel            string   `json:"risk_level"`
	TierRequirements     []string `json:"tier_requirements,omitempty"`
}

func ParseManifest(data []byte) (Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return Manifest{}, fmt.Errorf("parse manifest: %w", err)
	}
	if m.ID == "" || m.Version == "" {
		return Manifest{}, fmt.Errorf("manifest id/version required")
	}
	return m, nil
}
