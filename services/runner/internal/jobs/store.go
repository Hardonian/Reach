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

type Run struct {
	ID           string
	Capabilities map[string]struct{}
	Events       chan Event
}

type Store struct {
	mu      sync.RWMutex
	runs    map[string]*Run
	counter atomic.Uint64
	audit   AuditLogger
}

func NewStore(audit AuditLogger) *Store {
	return &Store{runs: make(map[string]*Run), audit: audit}
}

func (s *Store) CreateRun(requestID string, capabilities []string) *Run {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	capSet := make(map[string]struct{}, len(capabilities))
	for _, capability := range capabilities {
		capSet[capability] = struct{}{}
	}
	r := &Run{
		ID:           id,
		Capabilities: capSet,
		Events:       make(chan Event, 32),
	}

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
	select {
	case r.Events <- evt:
	default:
		<-r.Events
		r.Events <- evt
	}
	_ = s.Audit(id, requestID, "event.emitted", map[string]any{"type": evt.Type, "created_at": evt.CreatedAt})
	return nil
}

func (s *Store) Audit(runID, requestID, typ string, payload map[string]any) error {
	if s.audit == nil {
		return nil
	}
	return s.audit.Append(AuditEntry{
		RunID:     runID,
		RequestID: requestID,
		Timestamp: time.Now().UTC(),
		Type:      typ,
		Payload:   payload,
	})
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
