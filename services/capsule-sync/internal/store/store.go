package store

import (
	"errors"
	"sync"
	"time"

	"reach/services/capsule-sync/internal/core"
)

var ErrNotFound = errors.New("not found")

type SyncStore struct {
	mu          sync.RWMutex
	capsules    map[string]core.CapsuleMetadata
	devices     map[string]core.Device
	idempotency map[string]core.SyncResponse
}

func New() *SyncStore {
	return &SyncStore{capsules: map[string]core.CapsuleMetadata{}, devices: map[string]core.Device{}, idempotency: map[string]core.SyncResponse{}}
}

func deviceKey(tenant, id string) string { return tenant + ":" + id }

func (s *SyncStore) RegisterDevice(d core.Device) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.devices[deviceKey(d.TenantID, d.ID)] = d
}

func (s *SyncStore) Device(tenant, id string) (core.Device, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d, ok := s.devices[deviceKey(tenant, id)]
	return d, ok
}

func (s *SyncStore) Get(sessionID string) (core.CapsuleMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.capsules[sessionID]
	if !ok {
		return core.CapsuleMetadata{}, ErrNotFound
	}
	return v, nil
}

func (s *SyncStore) Upsert(req core.SyncRequest) core.SyncResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	if req.IdempotencyKey != "" {
		if prev, ok := s.idempotency[req.IdempotencyKey]; ok {
			return prev
		}
	}

	now := time.Now().UTC()
	incoming := req.Metadata
	incoming.UpdatedAt = now

	prev, exists := s.capsules[incoming.SessionID]
	resp := core.SyncResponse{Metadata: incoming}
	if exists {
		resp.Metadata.ServerVersion = prev.ServerVersion + 1
		if incoming.DeviceVersion <= prev.DeviceVersion {
			resp.Conflict = true
			resp.ConflictReason = "stale_device_version"
			resp.ResolvedUsing = "server_wins"
			resp.Metadata = prev
			resp.Metadata.ServerVersion = prev.ServerVersion + 1
			resp.Metadata.UpdatedAt = now
			s.capsules[incoming.SessionID] = resp.Metadata
		} else {
			resp.ResolvedUsing = "device_wins"
			s.capsules[incoming.SessionID] = resp.Metadata
		}
	} else {
		resp.Metadata.ServerVersion = 1
		resp.ResolvedUsing = "created"
		s.capsules[incoming.SessionID] = resp.Metadata
	}
	if req.IdempotencyKey != "" {
		s.idempotency[req.IdempotencyKey] = resp
	}
	return resp
}

func (s *SyncStore) Patch(sessionID string, fn func(*core.CapsuleMetadata) error) (core.CapsuleMetadata, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.capsules[sessionID]
	if !ok {
		return core.CapsuleMetadata{}, ErrNotFound
	}
	if err := fn(&current); err != nil {
		return core.CapsuleMetadata{}, err
	}
	current.ServerVersion++
	current.UpdatedAt = time.Now().UTC()
	s.capsules[sessionID] = current
	return current, nil
}
