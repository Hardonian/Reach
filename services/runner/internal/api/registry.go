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
	capabilities  []string
	lastSeen      time.Time
	latency       time.Duration
	load          int
	tags          []string
	contextShards []string
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
