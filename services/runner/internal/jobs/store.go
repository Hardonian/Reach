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
	ID          string
	Events      chan Event
	History     []Event
	EngineState []byte
	mu          sync.RWMutex
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
		ID:      id,
		Events:  make(chan Event, 32),
		History: make([]Event, 0, 32),
	}

	s.mu.Lock()
	s.runs[id] = r
	s.mu.Unlock()

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
	r.mu.Lock()
	r.History = append(r.History, evt)
	r.mu.Unlock()

	select {
	case r.Events <- evt:
	default:
		<-r.Events
		r.Events <- evt
	}
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
	if len(r.EngineState) == 0 {
		return nil, nil
	}
	state := make([]byte, len(r.EngineState))
	copy(state, r.EngineState)
	return state, nil
}
