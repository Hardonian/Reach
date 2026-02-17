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
	db         *storage.SQLiteStore
	counter    atomic.Uint64
	mu         sync.Mutex
	runTenants map[string]string
}

func NewStore(db *storage.SQLiteStore) *Store {
	return &Store{db: db, runTenants: map[string]string{}}
}

func (s *Store) CreateRun(ctx context.Context, tenantID string, capabilities []string) (*Run, error) {
	runID := fmt.Sprintf("run-%06d", s.counter.Add(1))
	rec := storage.RunRecord{ID: runID, TenantID: tenantID, Capabilities: capabilities, CreatedAt: time.Now().UTC(), Status: "created"}
	if err := s.db.CreateRun(ctx, rec); err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.runTenants[runID] = tenantID
	s.mu.Unlock()
	return &Run{ID: runID, TenantID: tenantID, Capabilities: toCapSet(capabilities)}, nil
}

func (s *Store) GetRun(ctx context.Context, tenantID, id string) (*Run, error) {
	rec, err := s.db.GetRun(ctx, tenantID, id)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	return &Run{ID: rec.ID, TenantID: rec.TenantID, Capabilities: toCapSet(rec.Capabilities)}, nil
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
	if evt.CreatedAt.IsZero() {
		evt.CreatedAt = time.Now().UTC()
	}
	_, err := s.GetRun(ctx, tenantID, runID)
	if err != nil {
		return 0, err
	}
	return s.db.AppendEvent(ctx, storage.EventRecord{RunID: runID, Type: evt.Type, Payload: evt.Payload, CreatedAt: evt.CreatedAt})
}

func (s *Store) EventHistory(ctx context.Context, tenantID, runID string, after int64) ([]Event, error) {
	if _, err := s.GetRun(ctx, tenantID, runID); err != nil {
		return nil, err
	}
	recs, err := s.db.ListEvents(ctx, tenantID, runID, after)
	if err != nil {
		return nil, err
	}
	out := make([]Event, 0, len(recs))
	for _, rec := range recs {
		out = append(out, Event{ID: rec.ID, Type: rec.Type, Payload: rec.Payload, CreatedAt: rec.CreatedAt})
	}
	return out, nil
}

func (s *Store) PublishEvent(runID string, evt Event, _ string) error {
	s.mu.Lock()
	tenantID := s.runTenants[runID]
	s.mu.Unlock()
	if tenantID == "" {
		return ErrRunNotFound
	}
	_, err := s.AppendEvent(context.Background(), tenantID, runID, evt)
	return err
}
func toCapSet(in []string) map[string]struct{} {
	out := make(map[string]struct{}, len(in))
	for _, cap := range in {
		out[cap] = struct{}{}
	}
	return out
}
