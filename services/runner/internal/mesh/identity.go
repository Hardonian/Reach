package mesh

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"
)

// NodeIdentityInfo provides deterministic, environment-aware node identification.
// The identity is derived from the node's public key and environment context,
// ensuring the same node in the same environment always produces the same ID.
type NodeIdentityInfo struct {
	// NodeID is the deterministic identifier derived from public key + environment
	NodeID string `json:"node_id"`
	// PublicKeyFingerprint is the hex-encoded SHA-256 fingerprint of the public key
	PublicKeyFingerprint string `json:"public_key_fingerprint"`
	// Environment captures the runtime context
	Environment EnvironmentInfo `json:"environment"`
}

// EnvironmentInfo captures the node's runtime environment for identity-aware routing.
type EnvironmentInfo struct {
	// Hostname is the machine hostname
	Hostname string `json:"hostname"`
	// OS is the operating system (linux, darwin, windows)
	OS string `json:"os"`
	// Arch is the CPU architecture (amd64, arm64)
	Arch string `json:"arch"`
	// Region is the deployment region (from REACH_REGION env)
	Region string `json:"region,omitempty"`
	// Zone is the availability zone (from REACH_ZONE env)
	Zone string `json:"zone,omitempty"`
	// Cluster is the cluster name (from REACH_CLUSTER env)
	Cluster string `json:"cluster,omitempty"`
	// Labels are arbitrary key-value pairs from REACH_NODE_LABELS (comma-separated key=value)
	Labels map[string]string `json:"labels,omitempty"`
}

// GenerateDeterministicNodeID produces a stable node ID from a public key and hostname.
// The ID is deterministic: same key + same host = same ID every time.
// Format: "reach-<first 16 hex chars of SHA-256(pubkey || hostname)>"
func GenerateDeterministicNodeID(pubKey ed25519.PublicKey, hostname string) string {
	h := sha256.New()
	h.Write(pubKey)
	h.Write([]byte("|"))
	h.Write([]byte(hostname))
	digest := h.Sum(nil)
	return "reach-" + hex.EncodeToString(digest[:8])
}

// PublicKeyFingerprint returns a hex-encoded fingerprint of the public key.
func PublicKeyFingerprint(pubKey ed25519.PublicKey) string {
	digest := sha256.Sum256(pubKey)
	return hex.EncodeToString(digest[:])
}

// DetectEnvironment reads the current runtime environment.
func DetectEnvironment() EnvironmentInfo {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}

	env := EnvironmentInfo{
		Hostname: hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		Region:   os.Getenv("REACH_REGION"),
		Zone:     os.Getenv("REACH_ZONE"),
		Cluster:  os.Getenv("REACH_CLUSTER"),
	}

	// Parse labels from REACH_NODE_LABELS (format: "key1=val1,key2=val2")
	if labelsRaw := os.Getenv("REACH_NODE_LABELS"); labelsRaw != "" {
		env.Labels = parseLabels(labelsRaw)
	}

	return env
}

// BuildNodeIdentity constructs a full NodeIdentityInfo from a key pair.
func BuildNodeIdentity(pubKey ed25519.PublicKey) NodeIdentityInfo {
	env := DetectEnvironment()
	return NodeIdentityInfo{
		NodeID:               GenerateDeterministicNodeID(pubKey, env.Hostname),
		PublicKeyFingerprint: PublicKeyFingerprint(pubKey),
		Environment:          env,
	}
}

// MatchesEnvironment checks if this node matches the given environment constraints.
// An empty constraint value matches any node.
func (info *NodeIdentityInfo) MatchesEnvironment(region, zone, cluster string) bool {
	if region != "" && info.Environment.Region != region {
		return false
	}
	if zone != "" && info.Environment.Zone != zone {
		return false
	}
	if cluster != "" && info.Environment.Cluster != cluster {
		return false
	}
	return true
}

// MatchesLabels checks if this node has all the specified labels.
func (info *NodeIdentityInfo) MatchesLabels(required map[string]string) bool {
	for k, v := range required {
		if info.Environment.Labels[k] != v {
			return false
		}
	}
	return true
}

// CanonicalString returns a canonical string representation for signing.
func (info *NodeIdentityInfo) CanonicalString() string {
	parts := []string{
		info.NodeID,
		info.PublicKeyFingerprint,
		info.Environment.Hostname,
		info.Environment.OS,
		info.Environment.Arch,
	}
	if info.Environment.Region != "" {
		parts = append(parts, "region="+info.Environment.Region)
	}
	if info.Environment.Zone != "" {
		parts = append(parts, "zone="+info.Environment.Zone)
	}
	if info.Environment.Cluster != "" {
		parts = append(parts, "cluster="+info.Environment.Cluster)
	}

	// Sort labels for deterministic output
	if len(info.Environment.Labels) > 0 {
		keys := make([]string, 0, len(info.Environment.Labels))
		for k := range info.Environment.Labels {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			parts = append(parts, fmt.Sprintf("label.%s=%s", k, info.Environment.Labels[k]))
		}
	}

	return strings.Join(parts, "|")
}

// parseLabels parses "key1=val1,key2=val2" into a map.
func parseLabels(raw string) map[string]string {
	labels := make(map[string]string)
	for _, pair := range strings.Split(raw, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if key != "" {
				labels[key] = val
			}
		}
	}
	return labels
}
