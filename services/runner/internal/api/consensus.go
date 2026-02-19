package api

import (
	"crypto/sha256"
	"fmt"
	"sync"
)

// ConsensusManager handles multi-node voting for critical tool results.
type ConsensusManager struct {
	mu     sync.Mutex
	groups map[string]*consensusGroup // key: runID:toolName:step
}

type consensusGroup struct {
	Threshold int
	Results   map[string]string         // NodeID -> ResultHash
	Payloads  map[string]map[string]any // NodeID -> Original Payload
	Resolved  bool
	Winner    map[string]any
}

func NewConsensusManager() *ConsensusManager {
	return &ConsensusManager{
		groups: make(map[string]*consensusGroup),
	}
}

// ReceiveResult adds a node's result to the consensus group and returns true if consensus is reached.
func (m *ConsensusManager) ReceiveResult(runID, toolName string, step int, nodeID string, threshold int, result map[string]any) (bool, map[string]any, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := fmt.Sprintf("%s:%s:%d", runID, toolName, step)
	group, ok := m.groups[key]
	if !ok {
		group = &consensusGroup{
			Threshold: threshold,
			Results:   make(map[string]string),
			Payloads:  make(map[string]map[string]any),
		}
		m.groups[key] = group
	}

	if group.Resolved {
		return true, group.Winner, nil
	}

	// Hash the result for comparison
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%v", result)))
	hash := fmt.Sprintf("%x", h.Sum(nil))

	group.Results[nodeID] = hash
	group.Payloads[nodeID] = result

	// Count occurrences of each hash
	counts := make(map[string]int)
	for _, h := range group.Results {
		counts[h]++
		if counts[h] >= threshold {
			group.Resolved = true
			group.Winner = result
			return true, result, nil
		}
	}

	return false, nil, nil
}
