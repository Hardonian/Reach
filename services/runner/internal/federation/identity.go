package federation

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"

	"reach/services/runner/internal/spec"
)

type NodeIdentity struct {
	NodeID               string   `json:"node_id"`
	PubKeyRef            string   `json:"pub_key_ref"`
	SpecVersion          string   `json:"spec_version"`
	CapabilitiesHash     string   `json:"capabilities_hash"`
	RegistrySnapshotHash string   `json:"registry_snapshot_hash"`
	SupportedModes       []string `json:"supported_modes"`
}

func BuildIdentity(nodeID, pubKey string, capabilities []string, registrySnapshotHash string, supportedModes []string) NodeIdentity {
	caps := append([]string(nil), capabilities...)
	sort.Strings(caps)
	modes := append([]string(nil), supportedModes...)
	sort.Strings(modes)
	return NodeIdentity{
		NodeID:               strings.TrimSpace(nodeID),
		PubKeyRef:            fingerprint(pubKey),
		SpecVersion:          spec.Version,
		CapabilitiesHash:     hashCSV(caps),
		RegistrySnapshotHash: strings.TrimSpace(registrySnapshotHash),
		SupportedModes:       modes,
	}
}

func fingerprint(raw string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(raw)))
	return hex.EncodeToString(sum[:8])
}

func hashCSV(items []string) string {
	sum := sha256.Sum256([]byte(strings.Join(items, ",")))
	return hex.EncodeToString(sum[:])
}
