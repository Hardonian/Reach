// Package federation provides ML-enhanced node reputation scoring
package federation

import (
	"hash/fnv"
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// ExecutionOutcomeType represents the type of execution outcome
type ExecutionOutcomeType int

const (
	OutcomeSuccess ExecutionOutcomeType = iota
	OutcomeFailure
	OutcomeTimeout
	OutcomeDrift
	OutcomeReplayMismatch
)

// ExecutionOutcome represents a single execution result
type ExecutionOutcome struct {
	Type        ExecutionOutcomeType
	Duration    time.Duration
	Verified    bool   // For success: was result verified correct
	Drifted     bool   // For failure: was due to drift
	ReplayMatch bool   // For replay: did it match historical
	Error       string // Error message if failed
}

// TaskProfile describes task requirements for routing
type TaskProfile struct {
	Priority             TaskPriority
	MaxLatencyMs         int
	RequiredAccuracy     float64
	RequiredCapabilities []string
}

// TaskPriority levels
type TaskPriority int

const (
	PriorityNormal TaskPriority = iota
	PriorityLatencySensitive
	PriorityCritical
	PriorityBackground
)

// CircuitState for circuit breaker
type CircuitState int32

const (
	StateClosed   CircuitState = 0 // Normal operation
	StateOpen     CircuitState = 1 // Failing fast
	StateHalfOpen CircuitState = 2 // Testing recovery
)

// MLReputationSnapshot for historical tracking
type MLReputationSnapshot struct {
	Timestamp      int64   `json:"timestamp"`
	SuccessRate    float64 `json:"success_rate"`
	LatencyP50     float64 `json:"latency_p50"`
	LatencyP99     float64 `json:"latency_p99"`
	CompositeScore float64 `json:"composite_score"`
}

// RingBuffer provides circular buffer for historical data
type RingBuffer[T any] struct {
	data []T
	head int
	size int
	mu   sync.RWMutex
}

// NewRingBuffer creates a new ring buffer with specified capacity
func NewRingBuffer[T any](capacity int) *RingBuffer[T] {
	return &RingBuffer[T]{
		data: make([]T, 0, capacity),
		head: 0,
		size: capacity,
	}
}

// Push adds an item to the buffer
func (rb *RingBuffer[T]) Push(item T) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	if len(rb.data) < rb.size {
		rb.data = append(rb.data, item)
	} else {
		rb.data[rb.head] = item
		rb.head = (rb.head + 1) % rb.size
	}
}

// GetAll returns all items in chronological order
func (rb *RingBuffer[T]) GetAll() []T {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if len(rb.data) < rb.size {
		result := make([]T, len(rb.data))
		copy(result, rb.data)
		return result
	}

	result := make([]T, rb.size)
	for i := 0; i < rb.size; i++ {
		idx := (rb.head + i) % rb.size
		result[i] = rb.data[idx]
	}
	return result
}

// Len returns current number of items
func (rb *RingBuffer[T]) Len() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return len(rb.data)
}

// ReputationDimensions tracks multiple performance vectors atomically
type ReputationDimensions struct {
	// Atomic counters for lock-free updates
	SuccessCount        atomic.Uint64
	FailureCount        atomic.Uint64
	DriftCount          atomic.Uint64
	TimeoutCount        atomic.Uint64
	ReplayMismatchCount atomic.Uint64

	// Exponential moving averages (smoothed values stored as uint64)
	// Values are scaled by 1,000,000 for precision
	latencyEMA    atomic.Uint64 // milliseconds
	throughputEMA atomic.Uint64 // ops/sec

	// Quality scores (0.0-1.0, stored as uint32 for atomic, scaled by 1,000,000)
	AccuracyScore     atomic.Uint32 // Verifiable correctness
	ConsistencyScore  atomic.Uint32 // Low variance in performance
	AvailabilityScore atomic.Uint32 // Uptime ratio

	// Timestamps
	LastUpdated atomic.Int64 // Unix nano
	LastSuccess atomic.Int64 // Unix nano
	LastFailure atomic.Int64 // Unix nano
}

// GetLatencyEMA returns the current latency EMA in milliseconds
func (rd *ReputationDimensions) GetLatencyEMA() float64 {
	return float64(rd.latencyEMA.Load()) / 1000000.0
}

// SetLatencyEMA updates the latency EMA
func (rd *ReputationDimensions) SetLatencyEMA(val float64) {
	rd.latencyEMA.Store(uint64(val * 1000000))
}

// GetThroughputEMA returns the current throughput EMA
func (rd *ReputationDimensions) GetThroughputEMA() float64 {
	return float64(rd.throughputEMA.Load()) / 1000000.0
}

// SetThroughputEMA updates the throughput EMA
func (rd *ReputationDimensions) SetThroughputEMA(val float64) {
	rd.throughputEMA.Store(uint64(val * 1000000))
}

// GetAccuracyScore returns accuracy score (0.0-1.0)
func (rd *ReputationDimensions) GetAccuracyScore() float64 {
	return float64(rd.AccuracyScore.Load()) / 1000000.0
}

// SetAccuracyScore updates accuracy score
func (rd *ReputationDimensions) SetAccuracyScore(val float64) {
	if val < 0 {
		val = 0
	} else if val > 1 {
		val = 1
	}
	rd.AccuracyScore.Store(uint32(val * 1000000))
}

// GetConsistencyScore returns consistency score (0.0-1.0)
func (rd *ReputationDimensions) GetConsistencyScore() float64 {
	return float64(rd.ConsistencyScore.Load()) / 1000000.0
}

// SetConsistencyScore updates consistency score
func (rd *ReputationDimensions) SetConsistencyScore(val float64) {
	if val < 0 {
		val = 0
	} else if val > 1 {
		val = 1
	}
	rd.ConsistencyScore.Store(uint32(val * 1000000))
}

// GetAvailabilityScore returns availability score (0.0-1.0)
func (rd *ReputationDimensions) GetAvailabilityScore() float64 {
	return float64(rd.AvailabilityScore.Load()) / 1000000.0
}

// SetAvailabilityScore updates availability score
func (rd *ReputationDimensions) SetAvailabilityScore(val float64) {
	if val < 0 {
		val = 0
	} else if val > 1 {
		val = 1
	}
	rd.AvailabilityScore.Store(uint32(val * 1000000))
}

// NodeReputation manages multi-dimensional reputation for a single node
type NodeReputation struct {
	NodeID     string
	Dimensions ReputationDimensions

	// Weighted composite score (calculated lazily, scaled by 1,000,000)
	compositeScore atomic.Uint32
	compositeValid atomic.Bool

	// Historical window for trend analysis
	history *RingBuffer[MLReputationSnapshot]

	// Circuit breaker state
	circuitState    atomic.Int32 // CircuitState values
	circuitOpens    atomic.Uint32
	lastCircuitOpen atomic.Int64 // Unix timestamp
	circuitMu       sync.Mutex   // For state transitions

	// Configuration
	mu           sync.RWMutex
	tags         map[string]string
	capabilities []string
}

// NewNodeReputation creates a new reputation tracker for a node
func NewNodeReputation(nodeID string) *NodeReputation {
	nr := &NodeReputation{
		NodeID:       nodeID,
		history:      NewRingBuffer[MLReputationSnapshot](100),
		tags:         make(map[string]string),
		capabilities: make([]string, 0),
	}

	// Initialize with neutral scores
	nr.Dimensions.SetAccuracyScore(0.5)
	nr.Dimensions.SetConsistencyScore(0.5)
	nr.Dimensions.SetAvailabilityScore(1.0)

	return nr
}

// RecordOutcome updates reputation with execution result
func (nr *NodeReputation) RecordOutcome(outcome ExecutionOutcome) {
	now := time.Now().UnixNano()
	nr.Dimensions.LastUpdated.Store(now)

	switch outcome.Type {
	case OutcomeSuccess:
		nr.Dimensions.SuccessCount.Add(1)
		nr.Dimensions.LastSuccess.Store(now)
		nr.updateLatencyEMA(outcome.Duration)
		nr.updateAccuracy(outcome.Verified)
		nr.recordSuccessForCircuitBreaker()

	case OutcomeFailure:
		nr.Dimensions.FailureCount.Add(1)
		nr.Dimensions.LastFailure.Store(now)
		nr.recordFailureForCircuitBreaker()

	case OutcomeTimeout:
		nr.Dimensions.TimeoutCount.Add(1)
		nr.Dimensions.LastFailure.Store(now)
		nr.Dimensions.SetAvailabilityScore(0)
		nr.recordFailureForCircuitBreaker()

	case OutcomeDrift:
		nr.Dimensions.DriftCount.Add(1)
		nr.Dimensions.LastFailure.Store(now)
		nr.recordFailureForCircuitBreaker()

	case OutcomeReplayMismatch:
		nr.Dimensions.ReplayMismatchCount.Add(1)
		nr.Dimensions.LastFailure.Store(now)
		nr.recordFailureForCircuitBreaker()
	}

	// Invalidate composite score
	nr.compositeValid.Store(false)

	// Snapshot history periodically (every 10 executions)
	total := nr.Dimensions.SuccessCount.Load() + nr.Dimensions.FailureCount.Load()
	if total > 0 && total%10 == 0 {
		nr.snapshot()
	}
}

// updateLatencyEMA uses exponential smoothing for O(1) updates
func (nr *NodeReputation) updateLatencyEMA(duration time.Duration) {
	newValue := float64(duration.Milliseconds())
	current := nr.Dimensions.GetLatencyEMA()

	if current == 0 {
		nr.Dimensions.SetLatencyEMA(newValue)
		return
	}

	// EMA: new_ema = 0.7*old + 0.3*new (alpha = 0.3)
	alpha := 0.3
	ema := current*(1-alpha) + newValue*alpha
	nr.Dimensions.SetLatencyEMA(ema)

	// Update consistency based on variance
	variance := math.Abs(newValue - current)
	if variance < 100 {
		// Low variance - high consistency
		nr.Dimensions.SetConsistencyScore(0.95)
	} else if variance < 500 {
		nr.Dimensions.SetConsistencyScore(0.7)
	} else {
		nr.Dimensions.SetConsistencyScore(0.4)
	}
}

// updateAccuracy adjusts accuracy score based on verification
func (nr *NodeReputation) updateAccuracy(verified bool) {
	current := nr.Dimensions.GetAccuracyScore()
	alpha := 0.2 // Slower updates for accuracy

	var target float64
	if verified {
		target = 1.0
	} else {
		target = 0.5
	}

	newScore := current*(1-alpha) + target*alpha
	nr.Dimensions.SetAccuracyScore(newScore)
}

// recordSuccessForCircuitBreaker handles success for circuit state
func (nr *NodeReputation) recordSuccessForCircuitBreaker() {
	state := CircuitState(nr.circuitState.Load())

	if state == StateHalfOpen {
		nr.circuitMu.Lock()
		defer nr.circuitMu.Unlock()

		// In half-open, enough successes close the circuit
		successes := nr.Dimensions.SuccessCount.Load()
		failures := nr.Dimensions.FailureCount.Load()
		total := successes + failures

		if total >= 5 { // Need 5 samples in half-open
			recentSuccessRate := float64(successes) / float64(total)
			if recentSuccessRate > 0.8 { // 80% success to close
				nr.transitionTo(StateClosed)
			}
		}
	}
}

// recordFailureForCircuitBreaker handles failure for circuit state
func (nr *NodeReputation) recordFailureForCircuitBreaker() {
	state := CircuitState(nr.circuitState.Load())

	// Only check thresholds in Closed or HalfOpen state
	if state == StateOpen {
		return
	}

	nr.circuitMu.Lock()
	defer nr.circuitMu.Unlock()

	successes := nr.Dimensions.SuccessCount.Load()
	failures := nr.Dimensions.FailureCount.Load()
	total := successes + failures

	// Need minimum samples before opening
	if total < 10 {
		return
	}

	failureRate := float64(failures) / float64(total)

	// Open circuit if failure rate > 50%
	if failureRate > 0.5 && CircuitState(nr.circuitState.Load()) != StateOpen {
		nr.transitionTo(StateOpen)
		nr.circuitOpens.Add(1)
		nr.lastCircuitOpen.Store(time.Now().Unix())

		// Schedule recovery attempt
		go func() {
			time.Sleep(30 * time.Second) // Cooldown period
			nr.transitionTo(StateHalfOpen)
		}()
	}
}

// transitionTo changes circuit state thread-safely
func (nr *NodeReputation) transitionTo(newState CircuitState) {
	nr.circuitState.Store(int32(newState))

	if newState == StateClosed {
		// Reset counters when closing
		nr.Dimensions.SuccessCount.Store(0)
		nr.Dimensions.FailureCount.Store(0)
	}
}

// GetCircuitState returns current circuit breaker state
func (nr *NodeReputation) GetCircuitState() CircuitState {
	return CircuitState(nr.circuitState.Load())
}

// IsCircuitOpen returns true if circuit is open
func (nr *NodeReputation) IsCircuitOpen() bool {
	return nr.GetCircuitState() == StateOpen
}

// snapshot creates a historical snapshot
func (nr *NodeReputation) snapshot() {
	snapshot := MLReputationSnapshot{
		Timestamp:      time.Now().Unix(),
		SuccessRate:    nr.getSuccessRate(),
		LatencyP50:     nr.Dimensions.GetLatencyEMA(),
		CompositeScore: nr.calculateComposite(),
	}
	nr.history.Push(snapshot)
}

// getSuccessRate calculates current success rate
func (nr *NodeReputation) getSuccessRate() float64 {
	successes := nr.Dimensions.SuccessCount.Load()
	failures := nr.Dimensions.FailureCount.Load()
	total := successes + failures

	if total == 0 {
		return 0.5 // Neutral default
	}

	return float64(successes) / float64(total)
}

// GetRoutingScore returns weighted score for task-specific routing
func (nr *NodeReputation) GetRoutingScore(task TaskProfile, globalStats *GlobalStats) float64 {
	// Check circuit breaker first
	if nr.IsCircuitOpen() {
		return -1.0 // Don't route to open circuits
	}

	// Lazy composite calculation
	if !nr.compositeValid.Load() {
		score := nr.calculateComposite()
		nr.compositeScore.Store(uint32(score * 1000000))
		nr.compositeValid.Store(true)
	}

	composite := float64(nr.compositeScore.Load()) / 1000000

	// Task-specific adjustments
	switch task.Priority {
	case PriorityCritical:
		// Require high accuracy, penalize failures heavily
		accuracy := nr.Dimensions.GetAccuracyScore()
		if accuracy < 0.95 {
			return -1.0 // Cannot handle critical tasks
		}
		successRate := nr.getSuccessRate()
		if successRate < 0.99 {
			return -1.0 // Need near-perfect reliability
		}
		return composite * accuracy * accuracy * successRate // Triple penalty

	case PriorityLatencySensitive:
		latency := nr.Dimensions.GetLatencyEMA()
		if task.MaxLatencyMs > 0 && int(latency) > task.MaxLatencyMs {
			return -1.0 // Too slow
		}

		if globalStats != nil && globalStats.MeanLatency > 0 {
			latencyRatio := globalStats.MeanLatency / latency
			return composite * latencyRatio
		}

	case PriorityBackground:
		// Lower standards for background tasks
		if composite < 0.3 {
			return -1.0
		}
		return composite * 0.8 // Slight penalty
	}

	return composite
}

// calculateComposite computes weighted reputation score
func (nr *NodeReputation) calculateComposite() float64 {
	// Weights for different dimensions
	const (
		accuracyWeight     = 0.35
		availabilityWeight = 0.25
		consistencyWeight  = 0.20
		successRateWeight  = 0.20
	)

	accuracy := nr.Dimensions.GetAccuracyScore()
	availability := nr.Dimensions.GetAvailabilityScore()
	consistency := nr.Dimensions.GetConsistencyScore()
	successRate := nr.getSuccessRate()

	composite := accuracy*accuracyWeight +
		availability*availabilityWeight +
		consistency*consistencyWeight +
		successRate*successRateWeight

	return math.Max(0, math.Min(1, composite))
}

// GetSnapshot returns current reputation snapshot
func (nr *NodeReputation) GetSnapshot() MLReputationSnapshot {
	return MLReputationSnapshot{
		Timestamp:      time.Now().Unix(),
		SuccessRate:    nr.getSuccessRate(),
		LatencyP50:     nr.Dimensions.GetLatencyEMA(),
		CompositeScore: nr.calculateComposite(),
	}
}

// GetHistory returns historical snapshots
func (nr *NodeReputation) GetHistory() []MLReputationSnapshot {
	return nr.history.GetAll()
}

// GlobalStats provides global normalization baselines
type GlobalStats struct {
	MeanLatency     float64
	MeanThroughput  float64
	MeanSuccessRate float64
}

// ReputationEngine manages reputation for all nodes
type ReputationEngine struct {
	// Configuration weights (tunable per deployment)
	Weights struct {
		Latency      float64
		Accuracy     float64
		Availability float64
		Consistency  float64
		Recency      float64 // Time-decay factor
	}

	// Node registry (64 shards based on hash)
	nodes [64]*sync.Map // shard by hash(nodeID) % 64

	// Global stats for normalization
	globalMu    sync.RWMutex
	globalStats GlobalStats
}

// NewReputationEngine creates a new reputation engine
func NewReputationEngine() *ReputationEngine {
	re := &ReputationEngine{}

	// Set default weights
	re.Weights.Latency = 0.25
	re.Weights.Accuracy = 0.30
	re.Weights.Availability = 0.20
	re.Weights.Consistency = 0.15
	re.Weights.Recency = 0.10

	// Initialize shards
	for i := 0; i < 64; i++ {
		re.nodes[i] = &sync.Map{}
	}

	return re
}

// getShard returns the shard for a nodeID
func (re *ReputationEngine) getShard(nodeID string) *sync.Map {
	h := fnv.New32a()
	h.Write([]byte(nodeID))
	return re.nodes[h.Sum32()%64]
}

// GetOrCreateNodeReputation gets or creates reputation for a node
func (re *ReputationEngine) GetOrCreateNodeReputation(nodeID string) *NodeReputation {
	shard := re.getShard(nodeID)

	if nr, ok := shard.Load(nodeID); ok {
		return nr.(*NodeReputation)
	}

	nr := NewNodeReputation(nodeID)
	actual, loaded := shard.LoadOrStore(nodeID, nr)
	if loaded {
		return actual.(*NodeReputation)
	}

	return nr
}

// GetNodeReputation retrieves reputation (returns nil if not found)
func (re *ReputationEngine) GetNodeReputation(nodeID string) *NodeReputation {
	shard := re.getShard(nodeID)

	if nr, ok := shard.Load(nodeID); ok {
		return nr.(*NodeReputation)
	}

	return nil
}

// RecordOutcome records an outcome for a node
func (re *ReputationEngine) RecordOutcome(nodeID string, outcome ExecutionOutcome) {
	nr := re.GetOrCreateNodeReputation(nodeID)
	nr.RecordOutcome(outcome)

	// Update global stats periodically
	execTotal := nr.Dimensions.SuccessCount.Load() + nr.Dimensions.FailureCount.Load()
	if execTotal > 0 && execTotal%100 == 0 {
		re.updateGlobalStats()
	}
}

// updateGlobalStats recalculates global normalization baselines
func (re *ReputationEngine) updateGlobalStats() {
	var totalLatency, totalSuccessRate float64
	var count int

	// Iterate all shards
	for i := 0; i < 64; i++ {
		re.nodes[i].Range(func(key, value any) bool {
			nr := value.(*NodeReputation)
			totalLatency += nr.Dimensions.GetLatencyEMA()
			totalSuccessRate += nr.getSuccessRate()
			count++
			return true
		})
	}

	if count > 0 {
		re.globalMu.Lock()
		re.globalStats.MeanLatency = totalLatency / float64(count)
		re.globalStats.MeanSuccessRate = totalSuccessRate / float64(count)
		re.globalMu.Unlock()
	}
}

// GetGlobalStats returns current global stats
func (re *ReputationEngine) GetGlobalStats() GlobalStats {
	re.globalMu.RLock()
	defer re.globalMu.RUnlock()
	return re.globalStats
}

// SelectBestNodes returns top N nodes for a task
func (re *ReputationEngine) SelectBestNodes(task TaskProfile, n int, excludeNodes []string) []*NodeReputation {
	excludeMap := make(map[string]bool)
	for _, id := range excludeNodes {
		excludeMap[id] = true
	}

	type scoredNode struct {
		nr    *NodeReputation
		score float64
	}

	var scored []scoredNode
	globalStats := re.GetGlobalStats()

	// Collect all nodes with scores
	for i := 0; i < 64; i++ {
		re.nodes[i].Range(func(key, value any) bool {
			nodeID := key.(string)
			if excludeMap[nodeID] {
				return true
			}

			nr := value.(*NodeReputation)
			score := nr.GetRoutingScore(task, &globalStats)

			if score >= 0 { // Only include routable nodes
				scored = append(scored, scoredNode{nr, score})
			}

			return true
		})
	}

	// Sort by score descending
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	// Return top N
	if n > len(scored) {
		n = len(scored)
	}

	result := make([]*NodeReputation, n)
	for i := 0; i < n; i++ {
		result[i] = scored[i].nr
	}

	return result
}

// GetAllNodes returns all node reputations
func (re *ReputationEngine) GetAllNodes() []*NodeReputation {
	var nodes []*NodeReputation

	for i := 0; i < 64; i++ {
		re.nodes[i].Range(func(key, value any) bool {
			nodes = append(nodes, value.(*NodeReputation))
			return true
		})
	}

	return nodes
}

// UpdateNodeTags updates tags for a node
func (re *ReputationEngine) UpdateNodeTags(nodeID string, tags map[string]string) {
	nr := re.GetOrCreateNodeReputation(nodeID)

	nr.mu.Lock()
	defer nr.mu.Unlock()

	for k, v := range tags {
		nr.tags[k] = v
	}
}

// GetNodeTags returns tags for a node
func (re *ReputationEngine) GetNodeTags(nodeID string) map[string]string {
	nr := re.GetNodeReputation(nodeID)
	if nr == nil {
		return nil
	}

	nr.mu.RLock()
	defer nr.mu.RUnlock()

	// Return copy
	result := make(map[string]string, len(nr.tags))
	for k, v := range nr.tags {
		result[k] = v
	}
	return result
}

// QuarantineNode marks a node as quarantined (circuit open)
func (re *ReputationEngine) QuarantineNode(nodeID string) {
	nr := re.GetOrCreateNodeReputation(nodeID)
	nr.transitionTo(StateOpen)
	nr.circuitOpens.Add(1)
	nr.lastCircuitOpen.Store(time.Now().Unix())
}

// RestoreNode attempts to restore a quarantined node
func (re *ReputationEngine) RestoreNode(nodeID string) {
	nr := re.GetNodeReputation(nodeID)
	if nr != nil {
		nr.transitionTo(StateHalfOpen)
	}
}

// GetStats returns engine statistics
func (re *ReputationEngine) GetStats() map[string]interface{} {
	var totalNodes, openCircuits uint32

	for i := 0; i < 64; i++ {
		re.nodes[i].Range(func(key, value any) bool {
			totalNodes++
			nr := value.(*NodeReputation)
			if nr.IsCircuitOpen() {
				openCircuits++
			}
			return true
		})
	}

	return map[string]interface{}{
		"total_nodes":   totalNodes,
		"open_circuits": openCircuits,
		"global_stats":  re.GetGlobalStats(),
	}
}
