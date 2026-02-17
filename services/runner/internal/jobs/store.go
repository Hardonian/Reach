package jobs

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"reach/services/runner/internal/storage"
)

var ErrRunNotFound = errors.New("run not found")
var ErrCapabilityDenied = errors.New("capability denied")

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

type Run struct {
	ID           string
	TenantID     string
	Capabilities map[string]struct{}
	Events       chan Event
	History      []Event
	EngineState  []byte
	Gates        map[string]Gate
	mu           sync.RWMutex
}

type Store struct {
	runs    storage.RunsStore
	events  storage.EventsStore
	audit   storage.AuditStore
	counter atomic.Uint64
	subMu   sync.RWMutex
	subs    map[string][]chan Event
}

func NewStore(audit ...AuditLogger) *Store {
	var logger AuditLogger
	if len(audit) > 0 {
		logger = audit[0]
	}
	return &Store{runs: make(map[string]*Run), audit: logger}
}

func (s *Store) CreateRun(ctx context.Context, tenantID string, capabilities []string) (*Run, error) {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	capSet := make(map[string]struct{}, len(capabilities))
	for _, capability := range capabilities {
		capSet[capability] = struct{}{}
	}
	r := &Run{ID: id, Capabilities: capSet, Events: make(chan Event, 32), History: make([]Event, 0, 32), Gates: map[string]Gate{}}

func toCapSet(c []string) map[string]struct{} {
	m := map[string]struct{}{}
	for _, v := range c {
		m[v] = struct{}{}
	}
	return m
}

func (s *Store) GetRun(ctx context.Context, tenantID, id string) (*Run, error) {
	r, err := s.runs.GetRun(ctx, tenantID, id)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	return &Run{ID: r.ID, TenantID: r.TenantID, Capabilities: toCapSet(r.Capabilities)}, nil
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

func (s *Store) AppendEvent(ctx context.Context, tenantID, runID string, evt Event) (int64, error) {
	id, err := s.events.AppendEvent(ctx, storage.EventRecord{RunID: runID, Type: evt.Type, Payload: evt.Payload, CreatedAt: evt.CreatedAt})
	if err != nil {
		return 0, err
	}
	_ = s.Audit(id, requestID, "event.emitted", map[string]any{"type": evt.Type})
	return nil
}

func (s *Store) EventHistory(id string) ([]Event, error) {
	r, err := s.GetRun(id)
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

func (s *Store) EngineState(id string) ([]byte, error) {
	r, err := s.GetRun(id)
	if err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]byte, len(r.EngineState))
	copy(out, r.EngineState)
	return out, nil
}

func (s *Store) SetGate(runID string, gate Gate) error {
	r, err := s.GetRun(runID)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Gates[gate.ID] = gate
	return nil
}

func (s *Store) ResolveGate(runID, gateID string, decision GateDecision) error {
	r, err := s.GetRun(runID)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	gate, ok := r.Gates[gateID]
	if !ok {
		return errors.New("gate not found")
	}
	gate.Decision = decision
	r.Gates[gateID] = gate
	if decision == GateApproveRun {
		for _, cap := range gate.Capabilities {
			r.Capabilities[cap] = struct{}{}
		}
	}
	return nil
}

func (s *Store) Audit(runID, requestID, typ string, payload map[string]any) error {
	if s.audit == nil {
		return nil
	}
	return s.audit.Append(AuditEntry{RunID: runID, RequestID: requestID, Timestamp: time.Now().UTC(), Type: typ, Payload: payload})
}

func (s *Store) ListAudit(runID string) ([]AuditEntry, error) {
	if _, err := s.GetRun(runID); err != nil {
		return nil, err
	}
	if s.audit == nil {
		return []AuditEntry{}, nil
	}
	return s.audit.List(runID)
}
