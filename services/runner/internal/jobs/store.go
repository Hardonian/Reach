package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/storage"
)

var ErrRunNotFound = errors.New("run not found")
var ErrCapabilityDenied = errors.New("capability denied")
var ErrBudgetExceeded = errors.New("budget exceeded")

// Event represents a single event in the event stream.
type Event struct {
	ID        int64
	Type      string
	Payload   []byte
	CreatedAt time.Time
}

type GateDecision string

const (
	GateApproveOnce GateDecision = "approve_once"
	GateApproveRun  GateDecision = "approve_run"
	GateDeny        GateDecision = "deny"
)

type Gate struct {
	ID           string       `json:"id"`
	Tool         string       `json:"tool"`
	Capabilities []string     `json:"capabilities"`
	Reason       string       `json:"reason"`
	Decision     GateDecision `json:"decision,omitempty"`
}

type AutonomousStatus string

const (
	AutonomousIdle      AutonomousStatus = "idle"
	AutonomousRunning   AutonomousStatus = "running"
	AutonomousPaused    AutonomousStatus = "paused"
	AutonomousStopping  AutonomousStatus = "stopping"
	AutonomousStopped   AutonomousStatus = "stopped"
	AutonomousCompleted AutonomousStatus = "completed"
)

type AutonomousSession struct {
	Goal                string           `json:"goal"`
	MaxIterations       int              `json:"max_iterations"`
	MaxRuntime          time.Duration    `json:"max_runtime"`
	MaxToolCalls        int              `json:"max_tool_calls"`
	AllowedCapabilities []string         `json:"allowed_capabilities"`
	IterationCount      int              `json:"iteration_count"`
	Status              AutonomousStatus `json:"status"`
	ToolCallCount       int              `json:"tool_call_count"`
	FailureStreak       int              `json:"failure_streak"`
	NoProgressStreak    int              `json:"no_progress_streak"`
	PackID              string           `json:"pack_id,omitempty"`
	PackVersion         string           `json:"pack_version,omitempty"`
	PackHash            string           `json:"pack_hash,omitempty"`
	Deterministic       bool             `json:"deterministic,omitempty"`
	StartedAt           time.Time        `json:"started_at"`
	UpdatedAt           time.Time        `json:"updated_at"`
	StopReason          string           `json:"stop_reason,omitempty"`
}

type Run struct {
	ID           string
	TenantID     string
	Capabilities map[string]struct{}
	Gates        map[string]Gate
	Autonomous   AutonomousSession
	Status       string
	CreatedAt    time.Time
	IsCritical   bool
	Fingerprint  string
	BudgetUSD    float64
	SpentUSD     float64
	SpendMu      sync.Mutex
}

type EventObserver func(runID string, evt Event)

type subEntry struct {
	ch     chan Event
	closed atomic.Bool
}

// Store provides durable storage for runs, events, and budgets
type Store struct {
	runs   storage.RunsStore
	events storage.EventsStore
	audit  storage.AuditStore

	counter  atomic.Uint64
	subs     sync.Map
	observe  EventObserver
	drift    *determinism.DriftMonitor
	hardened sync.Map // map[string]bool
	
	// Budget controllers per run (sharded for concurrency)
	// 256 shards to reduce lock contention
	budgets         [256]*sync.Map // sharded map: runID -> *BudgetController
	costRegistry    *CostRegistry   // Global cost model registry
	budgetMu        sync.RWMutex    // Protects budget initialization
}

// NewStore creates a new Store with budget sharding
func NewStore(db *storage.SQLiteStore) *Store {
	s := &Store{
		runs:         db,
		events:       db,
		audit:        db,
		drift:        determinism.NewDriftMonitor(),
		costRegistry: NewCostRegistry(),
	}
	
	// Initialize budget shards
	for i := 0; i < 256; i++ {
		s.budgets[i] = &sync.Map{}
	}
	
	return s
}

// WithObserver sets the event observer
func (s *Store) WithObserver(observer EventObserver) *Store {
	s.observe = observer
	return s
}

// GetCostRegistry returns the global cost registry
func (s *Store) GetCostRegistry() *CostRegistry {
	return s.costRegistry
}

// fnv32a computes FNV-1a hash for sharding
func fnv32a(s string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(s))
	return h.Sum32()
}

// shardedBudgetMap selects the appropriate shard for a runID
func (s *Store) shardedBudgetMap(runID string) *sync.Map {
	hash := fnv32a(runID)
	return s.budgets[hash%256]
}

// GetBudgetController retrieves or creates budget controller for a run
func (s *Store) GetBudgetController(runID, tenantID string, budgetUSD float64) *BudgetController {
	shard := s.shardedBudgetMap(runID)
	
	// Fast path: check if exists
	if bc, ok := shard.Load(runID); ok {
		return bc.(*BudgetController)
	}
	
	// Slow path: create new
	s.budgetMu.Lock()
	defer s.budgetMu.Unlock()
	
	// Double-check after acquiring lock
	if bc, ok := shard.Load(runID); ok {
		return bc.(*BudgetController)
	}
	
	// Create new budget controller
	bc := NewBudgetController(runID, tenantID, budgetUSD, s.costRegistry)
	actual, loaded := shard.LoadOrStore(runID, bc)
	if loaded {
		return actual.(*BudgetController)
	}
	
	return bc
}

// GetBudgetControllerForRun gets or creates budget controller with run's budget
func (s *Store) GetBudgetControllerForRun(ctx context.Context, tenantID, runID string) (*BudgetController, error) {
	run, err := s.GetRun(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	
	return s.GetBudgetController(runID, tenantID, run.BudgetUSD), nil
}

// RemoveBudgetController removes budget controller for a run (cleanup)
func (s *Store) RemoveBudgetController(runID string) {
	shard := s.shardedBudgetMap(runID)
	shard.Delete(runID)
}

func toCapSet(in []string) map[string]struct{} {
	out := make(map[string]struct{}, len(in))
	for _, cap := range in {
		out[cap] = struct{}{}
	}
	return out
}

func (s *Store) CreateRun(ctx context.Context, tenantID string, capabilities []string) (*Run, error) {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	now := time.Now().UTC()
	if err := s.runs.CreateRun(ctx, storage.RunRecord{ID: id, TenantID: tenantID, Capabilities: capabilities, CreatedAt: now, Status: "created"}); err != nil {
		return nil, err
	}
	return &Run{ID: id, TenantID: tenantID, Capabilities: toCapSet(capabilities), Gates: map[string]Gate{}, BudgetUSD: 10.0}, nil
}

func (s *Store) CreateRunWithBudget(ctx context.Context, tenantID string, capabilities []string, budgetUSD float64) (*Run, error) {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	now := time.Now().UTC()
	if err := s.runs.CreateRun(ctx, storage.RunRecord{ID: id, TenantID: tenantID, Capabilities: capabilities, CreatedAt: now, Status: "created"}); err != nil {
		return nil, err
	}
	
	// Ensure minimum budget
	if budgetUSD <= 0 {
		budgetUSD = 10.0
	}
	
	return &Run{ID: id, TenantID: tenantID, Capabilities: toCapSet(capabilities), Gates: map[string]Gate{}, BudgetUSD: budgetUSD}, nil
}

func (s *Store) GetRun(ctx context.Context, tenantID, id string) (*Run, error) {
	rec, err := s.runs.GetRun(ctx, tenantID, id)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	// Note: In a full implementation, we'd also load the event log to calculate Fingerprint and IsCritical
	return &Run{
		ID:           rec.ID,
		TenantID:     rec.TenantID,
		Capabilities: toCapSet(rec.Capabilities),
		Gates:        map[string]Gate{},
		Status:       rec.Status,
		CreatedAt:    rec.CreatedAt,
		IsCritical:   rec.Status == "finalized", // Simple heuristic for demo
		BudgetUSD:    10.0,                      // Default $10 budget for demo
	}, nil
}

func (s *Store) CheckCapabilities(ctx context.Context, tenantID, id string, required []string) error {
	r, err := s.GetRun(ctx, tenantID, id)
	if err != nil {
		return err
	}
	for _, c := range required {
		if _, ok := r.Capabilities[c]; !ok {
			return fmt.Errorf("%w: %s", ErrCapabilityDenied, c)
		}
	}
	return nil
}

func (s *Store) AppendEvent(ctx context.Context, runID string, evt Event) (int64, error) {
	if evt.CreatedAt.IsZero() {
		evt.CreatedAt = time.Now().UTC()
	}
	normalized, err := validateAndNormalizeEventPayload(evt.Type, evt.Payload)
	if err != nil {
		return 0, err
	}
	evt.Payload = normalized
	return s.events.AppendEvent(ctx, storage.EventRecord{RunID: runID, Type: evt.Type, Payload: evt.Payload, CreatedAt: evt.CreatedAt})
}

func (s *Store) PublishEvent(ctx context.Context, runID string, evt Event, _ string) error {
	id, err := s.AppendEvent(ctx, runID, evt)
	if err != nil {
		return err
	}
	evt.ID = id

	// Capture entropy drift for tool results in deterministic runs
	if evt.Type == "tool.result" && s.drift != nil {
		var payload struct {
			Tool   string `json:"tool"`
			Result any    `json:"result"`
		}
		if err := json.Unmarshal(evt.Payload, &payload); err == nil {
			hash := determinism.Hash(payload.Result)
			// For demo, we use a fixed pack ID
			score, drifted := s.drift.CheckDrift(runID, "pack-alpha", 0, hash)

			// Self-Healing: If drift is high, harden the run
			if drifted && score > 0.5 {
				s.hardened.Store(runID, true)
				_ = s.Audit(ctx, "", runID, "drift.alert", []byte(fmt.Sprintf("High entropy detected (score: %.2f); run hardened to ModeStrict", score)))
			}
		}
	}

	if val, ok := s.subs.Load(runID); ok {
		subs := val.(*sync.Map)
		subs.Range(func(key, value any) bool {
			entry := value.(*subEntry)
			if entry.closed.Load() {
				return true
			}
			select {
			case entry.ch <- evt:
			default:
			}
			return true
		})
	}
	if s.observe != nil {
		s.observe(runID, evt)
	}
	return nil
}

func (s *Store) EventHistory(ctx context.Context, tenantID, runID string, after int64) ([]Event, error) {
	rec, err := s.events.ListEvents(ctx, tenantID, runID, after)
	if err != nil {
		return nil, err
	}
	out := make([]Event, len(rec))
	for i, r := range rec {
		out[i] = Event{ID: r.ID, Type: r.Type, Payload: r.Payload, CreatedAt: r.CreatedAt}
	}
	return out, nil
}

func (s *Store) Subscribe(runID string) (<-chan Event, func()) {
	ch := make(chan Event, 32)
	entry := &subEntry{ch: ch}

	subMapI, _ := s.subs.LoadOrStore(runID, &sync.Map{})
	subMap := subMapI.(*sync.Map)
	subMap.Store(ch, entry)

	return ch, func() {
		entry.closed.Store(true)
		subMap.Delete(ch)
		close(ch)
	}
}

func (s *Store) SetGate(_ context.Context, runID string, gate Gate) error {
	body, _ := json.Marshal(gate)
	return s.PublishEvent(context.Background(), runID, Event{Type: "policy.gate.stored", Payload: body, CreatedAt: time.Now().UTC()}, "gate")
}

func (s *Store) ResolveGate(ctx context.Context, tenantID, runID, gateID string, decision GateDecision) error {
	if _, err := s.GetRun(ctx, tenantID, runID); err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]any{"gate_id": gateID, "decision": decision})
	return s.PublishEvent(context.Background(), runID, Event{Type: "policy.gate.resolved", Payload: body, CreatedAt: time.Now().UTC()}, "gate")
}

func (s *Store) Audit(ctx context.Context, tenantID, runID, typ string, payload []byte) error {
	return s.audit.AppendAudit(ctx, storage.AuditRecord{TenantID: tenantID, RunID: runID, Type: typ, Payload: payload, CreatedAt: time.Now().UTC()})
}

func (s *Store) ListAudit(ctx context.Context, tenantID, runID string) ([]storage.AuditRecord, error) {
	return s.audit.ListAudit(ctx, tenantID, runID)
}

func (s *Store) IsHardened(runID string) bool {
	val, ok := s.hardened.Load(runID)
	return ok && val.(bool)
}

// Legacy CheckBudget - now delegates to BudgetController
func (s *Store) CheckBudget(ctx context.Context, tenantID, runID string, estimatedCost float64) error {
	bc, err := s.GetBudgetControllerForRun(ctx, tenantID, runID)
	if err != nil {
		return err
	}
	
	alloc := bc.PredictAndReserve(ctx, "unknown", 0)
	if !alloc.Approved {
		return ErrBudgetExceeded
	}
	
	// Immediately commit for legacy compatibility
	bc.CommitSpend(alloc.AllocatedID, estimatedCost, "unknown")
	
	return nil
}

// Legacy RecordSpend - now delegates to BudgetController
func (s *Store) RecordSpend(ctx context.Context, tenantID, runID string, amount float64) error {
	bc, err := s.GetBudgetControllerForRun(ctx, tenantID, runID)
	if err != nil {
		return err
	}
	
	bc.CommitSpend(0, amount, "manual")
	
	return s.Audit(ctx, tenantID, runID, "economic.spend", []byte(fmt.Sprintf("$%.2f", amount)))
}

// PredictAndReserve budget for a tool call
func (s *Store) PredictAndReserve(ctx context.Context, tenantID, runID, tool string, estimatedTokens int) (AllocationResult, error) {
	bc, err := s.GetBudgetControllerForRun(ctx, tenantID, runID)
	if err != nil {
		return AllocationResult{}, err
	}
	
	return bc.PredictAndReserve(ctx, tool, estimatedTokens), nil
}

// CommitSpend records actual spend
func (s *Store) CommitSpend(ctx context.Context, tenantID, runID string, allocID uint64, actualCost float64, tool string) error {
	bc, err := s.GetBudgetControllerForRun(ctx, tenantID, runID)
	if err != nil {
		return err
	}
	
	bc.CommitSpend(allocID, actualCost, tool)
	
	// Audit the spend
	return s.Audit(ctx, tenantID, runID, "economic.spend", []byte(fmt.Sprintf("tool:%s amount:$%.4f", tool, actualCost)))
}

// GetBudgetStatus returns budget status for a run
func (s *Store) GetBudgetStatus(ctx context.Context, tenantID, runID string) (map[string]interface{}, error) {
	bc, err := s.GetBudgetControllerForRun(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	
	return bc.GetStatus(), nil
}
