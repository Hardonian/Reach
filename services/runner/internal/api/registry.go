package api

import (
	"sync"
	"time"
)

type autoControl struct {
	mu           sync.Mutex
	goal         string
	maxIter      int
	maxRuntime   time.Duration
	maxToolCalls int
	sleepTime    time.Duration
	started      time.Time
	cancel       func()
}

type NodeRegistry struct {
	mu    sync.RWMutex
	nodes map[string]nodeInfo
}

type nodeInfo struct {
	capabilities     []string
	lastSeen         time.Time
	latency          time.Duration
	load             int
	tags             []string
	contextShards    []string
	reliabilityScore float64 // 0.0 - 1.0
}

func NewNodeRegistry() *NodeRegistry {
	return &NodeRegistry{
		nodes: make(map[string]nodeInfo),
	}
}

func supportsAll(provided, required []string) bool {
	lookup := make(map[string]bool)
	for _, p := range provided {
		lookup[p] = true
	}
	for _, r := range required {
		if !lookup[r] {
			return false
		}
	}
	return true
}

func (r *NodeRegistry) UpdateReputation(nodeID string, drifted bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.nodes[nodeID]
	if !ok {
		return
	}

	if drifted {
		info.reliabilityScore -= 0.1
		if info.reliabilityScore < 0.0 {
			info.reliabilityScore = 0.0
		}
	} else {
		info.reliabilityScore += 0.01 // Slow recovery
		if info.reliabilityScore > 1.0 {
			info.reliabilityScore = 1.0
		}
	}
	r.nodes[nodeID] = info
}

func (r *NodeRegistry) GetReliability(nodeID string) float64 {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if info, ok := r.nodes[nodeID]; ok {
		return info.reliabilityScore
	}
	return 0.5 // Unknown
}
