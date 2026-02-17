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

// AuditLogger is an optional append-only sink for run level audit trails.
type AuditLogger interface {
	Append(AuditEntry) error
	List(runID string) ([]AuditEntry, error)
}

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
	ID           string
	Tool         string
	Capabilities []string
	Reason       string
	Decision     GateDecision
}

type AutonomousStatus string

const (
	AutonomousIdle      AutonomousStatus = "idle"
	AutonomousRunning   AutonomousStatus = "running"
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
	mu           sync.RWMutex
}

type Store struct {
	runs   storage.RunsStore
	events storage.EventsStore
	audit  storage.AuditStore

	counter atomic.Uint64
	subMu   sync.RWMutex
	subs    map[string][]chan Event
}

func NewStore(db *storage.SQLiteStore) *Store {
	return &Store{runs: db, events: db, audit: db, subs: map[string][]chan Event{}}
}

func toCapSet(c []string) map[string]struct{} {
	m := make(map[string]struct{}, len(c))
	for _, v := range c {
		m[v] = struct{}{}
	}
	return m
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
	r, err := s.runs.GetRun(ctx, tenantID, id)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	return &Run{ID: r.ID, TenantID: r.TenantID, Capabilities: toCapSet(r.Capabilities), Gates: map[string]Gate{}}, nil
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
	return s.events.AppendEvent(ctx, storage.EventRecord{RunID: runID, Type: evt.Type, Payload: evt.Payload, CreatedAt: evt.CreatedAt})
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

func (s *Store) ResolveGate(_ context.Context, runID, gateID string, decision GateDecision) error {
	body, _ := json.Marshal(map[string]any{"gate_id": gateID, "decision": decision})
	return s.PublishEvent(context.Background(), runID, Event{Type: "policy.gate.resolved", Payload: body, CreatedAt: time.Now().UTC()}, "gate")
}

func (s *Store) Audit(ctx context.Context, tenantID, runID, typ string, payload []byte) error {
	return s.audit.AppendAudit(ctx, storage.AuditRecord{TenantID: tenantID, RunID: runID, Type: typ, Payload: payload, CreatedAt: time.Now().UTC()})
}

func (s *Store) ListAudit(ctx context.Context, tenantID, runID string) ([]storage.AuditRecord, error) {
	return s.audit.ListAudit(ctx, tenantID, runID)
}
