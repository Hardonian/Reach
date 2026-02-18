package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/storage"
)

var ErrRunNotFound = errors.New("run not found")
var ErrCapabilityDenied = errors.New("capability denied")

// Event represents a single event in the event stream.
// CreatedAt uses int64 (Unix timestamp) for deterministic serialization.
type Event struct {
	ID        int64
	Type      string
	Payload   []byte
	CreatedAt int64 // Unix timestamp for determinism
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
}

type EventObserver func(runID string, evt Event)

type Store struct {
	runs   storage.RunsStore
	events storage.EventsStore
	audit  storage.AuditStore

	counter atomic.Uint64
	subMu   sync.RWMutex
	subs    map[string][]chan Event
	observe EventObserver
}

func NewStore(db *storage.SQLiteStore) *Store {
	return &Store{runs: db, events: db, audit: db, subs: map[string][]chan Event{}}
}

func (s *Store) WithObserver(observer EventObserver) *Store {
	s.observe = observer
	return s
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
	return &Run{ID: id, TenantID: tenantID, Capabilities: toCapSet(capabilities), Gates: map[string]Gate{}}, nil
}

func (s *Store) GetRun(ctx context.Context, tenantID, id string) (*Run, error) {
	rec, err := s.runs.GetRun(ctx, tenantID, id)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	return &Run{ID: rec.ID, TenantID: rec.TenantID, Capabilities: toCapSet(rec.Capabilities), Gates: map[string]Gate{}}, nil
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
	// Use deterministic timestamp (0 = epoch) for replay consistency
	if evt.CreatedAt == 0 {
		evt.CreatedAt = 0
	}
	normalized, err := validateAndNormalizeEventPayload(evt.Type, evt.Payload)
	if err != nil {
		return 0, err
	}
	evt.Payload = normalized
	// Convert int64 timestamp back to time.Time for storage
	return s.events.AppendEvent(ctx, storage.EventRecord{RunID: runID, Type: evt.Type, Payload: evt.Payload, CreatedAt: time.Unix(evt.CreatedAt, 0)})
}

func (s *Store) PublishEvent(ctx context.Context, runID string, evt Event, _ string) error {
	id, err := s.AppendEvent(ctx, runID, evt)
	if err != nil {
		return err
	}
	evt.ID = id
	s.subMu.RLock()
	defer s.subMu.RUnlock()
	for _, ch := range s.subs[runID] {
		select {
		case ch <- evt:
		default:
		}
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
		// Convert time.Time to int64 Unix timestamp for determinism
		out[i] = Event{ID: r.ID, Type: r.Type, Payload: r.Payload, CreatedAt: r.CreatedAt.Unix()}
	}
	return out, nil
}

func (s *Store) Subscribe(runID string) (<-chan Event, func()) {
	ch := make(chan Event, 32)
	s.subMu.Lock()
	s.subs[runID] = append(s.subs[runID], ch)
	s.subMu.Unlock()
	return ch, func() {
		s.subMu.Lock()
		defer s.subMu.Unlock()
		close(ch)
		cur := s.subs[runID]
		out := cur[:0]
		for _, c := range cur {
			if c != ch {
				out = append(out, c)
			}
		}
		if len(out) == 0 {
			delete(s.subs, runID)
		} else {
			s.subs[runID] = out
		}
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
