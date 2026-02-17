package jobs

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var ErrRunNotFound = errors.New("run not found")

type Event struct {
	Type      string
	Payload   []byte
	CreatedAt time.Time
}

type Run struct {
	ID     string
	Events chan Event
}

type Store struct {
	mu      sync.RWMutex
	runs    map[string]*Run
	counter atomic.Uint64
}

func NewStore() *Store {
	return &Store{runs: make(map[string]*Run)}
}

func (s *Store) CreateRun() *Run {
	id := fmt.Sprintf("run-%06d", s.counter.Add(1))
	r := &Run{
		ID:     id,
		Events: make(chan Event, 32),
	}

	s.mu.Lock()
	s.runs[id] = r
	s.mu.Unlock()

	s.PublishEvent(id, Event{Type: "run.created", Payload: []byte(`{"status":"created"}`), CreatedAt: time.Now().UTC()})
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

func (s *Store) PublishEvent(id string, evt Event) error {
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
	return nil
}
