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

type Run struct {
	ID           string
	TenantID     string
	Capabilities map[string]struct{}
}

type Store struct {
	runs    storage.RunsStore
	events  storage.EventsStore
	audit   storage.AuditStore
	counter atomic.Uint64
	subMu   sync.RWMutex
	subs    map[string][]chan Event
}

func NewStore(db *storage.SQLiteStore) *Store {
	return &Store{runs: db, events: db, audit: db, subs: map[string][]chan Event{}}
}

func (s *Store) CreateRun(ctx context.Context, tenantID string, capabilities []string) (*Run, error) {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	r := storage.RunRecord{ID: id, TenantID: tenantID, Capabilities: capabilities, CreatedAt: time.Now().UTC(), Status: "created"}
	if err := s.runs.CreateRun(ctx, r); err != nil {
		return nil, err
	}
	body := []byte(`{"status":"created"}`)
	_, _ = s.AppendEvent(ctx, tenantID, id, Event{Type: "run.created", Payload: body, CreatedAt: time.Now().UTC()})
	return &Run{ID: id, TenantID: tenantID, Capabilities: toCapSet(capabilities)}, nil
}

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
	evt.ID = id
	s.subMu.RLock()
	subs := append([]chan Event(nil), s.subs[runID]...)
	s.subMu.RUnlock()
	for _, ch := range subs {
		select {
		case ch <- evt:
		default:
		}
	}
	return id, nil
}

func (s *Store) EventHistory(ctx context.Context, tenantID, runID string, afterID int64) ([]Event, error) {
	rec, err := s.events.ListEvents(ctx, tenantID, runID, afterID)
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

func (s *Store) Audit(ctx context.Context, tenantID, runID, typ string, payload []byte) error {
	return s.audit.AppendAudit(ctx, storage.AuditRecord{TenantID: tenantID, RunID: runID, Type: typ, Payload: payload, CreatedAt: time.Now().UTC()})
}
func (s *Store) ListAudit(ctx context.Context, tenantID, runID string) ([]storage.AuditRecord, error) {
	return s.audit.ListAudit(ctx, tenantID, runID)
}
