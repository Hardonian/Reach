package federation

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type LatencySnapshot struct {
	P50MS int `json:"p50_ms"`
	P95MS int `json:"p95_ms"`
}

type ReputationSnapshot struct {
	DelegationsSucceeded      int             `json:"delegations_succeeded"`
	DelegationsFailedByReason map[string]int  `json:"delegations_failed_by_reason"`
	PolicyDenials             int             `json:"policy_denials"`
	ReplayMismatchIncidents   int             `json:"replay_mismatch_incidents"`
	SpecMismatchIncidents     int             `json:"spec_mismatch_incidents"`
	RegistryMismatchIncidents int             `json:"registry_mismatch_incidents"`
	Latency                   LatencySnapshot `json:"latency"`
}

type NodeStats struct {
	NodeID               string             `json:"node_id"`
	SpecVersion          string             `json:"spec_version"`
	RegistrySnapshotHash string             `json:"registry_snapshot_hash"`
	Quarantined          bool               `json:"quarantined"`
	Snapshot             ReputationSnapshot `json:"snapshot"`
}

type Store struct {
	mu    sync.Mutex
	path  string
	Nodes map[string]NodeStats `json:"nodes"`
}

func NewStore(path string) *Store {
	return &Store{path: path, Nodes: map[string]NodeStats{}}
}

func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	buf, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var loaded Store
	if err := json.Unmarshal(buf, &loaded); err != nil {
		return err
	}
	if loaded.Nodes == nil {
		loaded.Nodes = map[string]NodeStats{}
	}
	s.Nodes = loaded.Nodes
	return nil
}

func (s *Store) Save() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	copy := struct {
		Nodes map[string]NodeStats `json:"nodes"`
	}{Nodes: s.Nodes}
	buf, err := json.MarshalIndent(copy, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, buf, 0o644)
}

func (s *Store) Upsert(node NodeStats) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if node.Snapshot.DelegationsFailedByReason == nil {
		node.Snapshot.DelegationsFailedByReason = map[string]int{}
	}
	s.Nodes[node.NodeID] = node
}

func (s *Store) Get(nodeID string) NodeStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.Nodes[nodeID]
	if !ok {
		return NodeStats{NodeID: nodeID, Snapshot: ReputationSnapshot{DelegationsFailedByReason: map[string]int{}}}
	}
	if n.Snapshot.DelegationsFailedByReason == nil {
		n.Snapshot.DelegationsFailedByReason = map[string]int{}
	}
	return n
}

// Update atomically reads, modifies, and writes back a node under a single lock hold.
// This prevents the race condition where Get() + modify + Upsert() could lose concurrent updates.
func (s *Store) Update(nodeID string, fn func(node *NodeStats)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.Nodes[nodeID]
	if !ok {
		n = NodeStats{NodeID: nodeID, Snapshot: ReputationSnapshot{DelegationsFailedByReason: map[string]int{}}}
	}
	if n.Snapshot.DelegationsFailedByReason == nil {
		n.Snapshot.DelegationsFailedByReason = map[string]int{}
	}
	fn(&n)
	s.Nodes[nodeID] = n
}

func (s *Store) List() []NodeStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]NodeStats, 0, len(s.Nodes))
	for _, node := range s.Nodes {
		out = append(out, node)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].NodeID < out[j].NodeID })
	return out
}
