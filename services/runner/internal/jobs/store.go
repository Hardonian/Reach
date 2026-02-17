package jobs

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var ErrRunNotFound = errors.New("run not found")
var ErrCapabilityDenied = errors.New("capability denied")

type Event struct {
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
	Capabilities map[string]struct{}
	Events       chan Event
	History      []Event
	EngineState  []byte
	Gates        map[string]Gate
	mu           sync.RWMutex
}

type Store struct {
	mu      sync.RWMutex
	runs    map[string]*Run
	counter atomic.Uint64
	audit   AuditLogger
}

func NewStore(audit ...AuditLogger) *Store {
	var logger AuditLogger
	if len(audit) > 0 {
		logger = audit[0]
	}
	return &Store{runs: make(map[string]*Run), audit: logger}
}

func (s *Store) CreateRun(requestID string, capabilities []string) *Run {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	capSet := make(map[string]struct{}, len(capabilities))
	for _, capability := range capabilities {
		capSet[capability] = struct{}{}
	}
	r := &Run{ID: id, Capabilities: capSet, Events: make(chan Event, 32), History: make([]Event, 0, 32), Gates: map[string]Gate{}}

	s.mu.Lock()
	s.runs[id] = r
	s.mu.Unlock()

	_ = s.Audit(id, requestID, "run.created", map[string]any{"capabilities": capabilities})
	_ = s.PublishEvent(id, Event{Type: "run.created", Payload: []byte(`{"status":"created"}`), CreatedAt: time.Now().UTC()}, requestID)
	return r
}

func (s *Store) GetRun(id string) (*Run, error) {
	s.mu.RLock()
	r, ok := s.runs[id]
	s.mu.RUnlock()
	if !ok {
		return nil, ErrRunNotFound
	}
	return r, nil
}

func (s *Store) CheckCapabilities(id string, required []string) error {
	r, err := s.GetRun(id)
	if err != nil {
		return err
	}
	for _, capability := range required {
		if _, ok := r.Capabilities[capability]; !ok {
			return fmt.Errorf("%w: %s", ErrCapabilityDenied, capability)
		}
	}
	return nil
}

func (s *Store) PublishEvent(id string, evt Event, requestID string) error {
	r, err := s.GetRun(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	r.History = append(r.History, evt)
	r.mu.Unlock()

	select {
	case r.Events <- evt:
	default:
		<-r.Events
		r.Events <- evt
	}
	_ = s.Audit(id, requestID, "event.emitted", map[string]any{"type": evt.Type})
	return nil
}

func (s *Store) EventHistory(id string) ([]Event, error) {
	r, err := s.GetRun(id)
	if err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Event, len(r.History))
	copy(out, r.History)
	return out, nil
}

func (s *Store) SetEngineState(id string, state []byte) error {
	r, err := s.GetRun(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.EngineState = append([]byte(nil), state...)
	return nil
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
