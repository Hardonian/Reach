package federation

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type StatusNode struct {
	NodeID               string          `json:"node_id"`
	TrustScore           int             `json:"trust_score"`
	Compatible           bool            `json:"compatible"`
	DelegationSucceeded  int             `json:"delegation_succeeded"`
	DelegationFailed     int             `json:"delegation_failed"`
	Latency              LatencySnapshot `json:"latency"`
	Quarantined          bool            `json:"quarantined"`
	SpecVersion          string          `json:"spec_version"`
	RegistrySnapshotHash string          `json:"registry_snapshot_hash"`
}

type Coordinator struct {
	store *Store
}

func NewCoordinator(path string) *Coordinator {
	return &Coordinator{store: NewStore(path)}
}

func (c *Coordinator) Load() error { return c.store.Load() }
func (c *Coordinator) Save() error { return c.store.Save() }

func (c *Coordinator) RecordDelegation(nodeID, specVersion, registryHash string, success bool, reason string, latencyMS int, replayMismatch bool) {
	// Use atomic Update to prevent race condition between Get() and Upsert()
	c.store.Update(nodeID, func(node *NodeStats) {
		if strings.TrimSpace(specVersion) != "" {
			node.SpecVersion = specVersion
		}
		if strings.TrimSpace(registryHash) != "" {
			node.RegistrySnapshotHash = registryHash
		}
		if success {
			node.Snapshot.DelegationsSucceeded++
		} else {
			node.Snapshot.DelegationsFailedByReason[reason]++
		}
		reasonLower := strings.ToLower(reason)
		if strings.Contains(reasonLower, "policy") {
			node.Snapshot.PolicyDenials++
		}
		if strings.Contains(reasonLower, "spec") {
			node.Snapshot.SpecMismatchIncidents++
		}
		if strings.Contains(reasonLower, "registry") {
			node.Snapshot.RegistryMismatchIncidents++
		}
		if replayMismatch {
			node.Snapshot.ReplayMismatchIncidents++
		}
		if latencyMS > 0 {
			if node.Snapshot.Latency.P50MS == 0 || latencyMS < node.Snapshot.Latency.P50MS {
				node.Snapshot.Latency.P50MS = latencyMS
			}
			if latencyMS > node.Snapshot.Latency.P95MS {
				node.Snapshot.Latency.P95MS = latencyMS
			}
		}
		node.Quarantined = ShouldQuarantine(TrustScore(node.Snapshot), replayMismatch, 35)
	})
}

func (c *Coordinator) Status() []StatusNode {
	nodes := c.store.List()
	out := make([]StatusNode, 0, len(nodes))
	for _, n := range nodes {
		failed := 0
		for _, v := range n.Snapshot.DelegationsFailedByReason {
			failed += v
		}
		out = append(out, StatusNode{
			NodeID:               n.NodeID,
			TrustScore:           TrustScore(n.Snapshot),
			Compatible:           n.Snapshot.SpecMismatchIncidents == 0 && n.Snapshot.RegistryMismatchIncidents == 0,
			DelegationSucceeded:  n.Snapshot.DelegationsSucceeded,
			DelegationFailed:     failed,
			Latency:              n.Snapshot.Latency,
			Quarantined:          n.Quarantined,
			SpecVersion:          n.SpecVersion,
			RegistrySnapshotHash: n.RegistrySnapshotHash,
		})
	}
	return out
}

func SaveStatus(path string, nodes []StatusNode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	buf, err := json.MarshalIndent(nodes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, buf, 0o644)
}

func (c *Coordinator) GetNode(nodeID string) NodeStats {
	return c.store.Get(nodeID)
}

func (c *Coordinator) UpsertNode(node NodeStats) {
	c.store.Upsert(node)
}
