package mesh

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Event represents a single event in the mesh
type Event struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Source    string          `json:"source"` // Node ID that created the event
	Timestamp int64           `json:"timestamp"`
	VectorClock VectorClock   `json:"vc"`
	Payload   json.RawMessage `json:"payload"`
	Signature []byte          `json:"sig"`
}

// VectorClock for causal ordering
type VectorClock map[string]int64

// Merge combines two vector clocks
func (vc VectorClock) Merge(other VectorClock) VectorClock {
	result := make(VectorClock)
	for k, v := range vc {
		result[k] = v
	}
	for k, v := range other {
		if v > result[k] {
			result[k] = v
		}
	}
	return result
}

// Compare returns the relationship between two vector clocks
// -1: vc < other (vc happened before)
// 0: vc == other (concurrent or equal)
// 1: vc > other (vc happened after)
func (vc VectorClock) Compare(other VectorClock) int {
	allKeys := make(map[string]struct{})
	for k := range vc {
		allKeys[k] = struct{}{}
	}
	for k := range other {
		allKeys[k] = struct{}{}
	}
	
	less := false
	greater := false
	
	for k := range allKeys {
		v1 := vc[k]
		v2 := other[k]
		if v1 < v2 {
			less = true
		} else if v1 > v2 {
			greater = true
		}
	}
	
	if less && !greater {
		return -1
	}
	if greater && !less {
		return 1
	}
	return 0
}

// Increment increments the entry for a node
func (vc VectorClock) Increment(nodeID string) VectorClock {
	result := vc.Merge(nil) // Copy
	result[nodeID] = result[nodeID] + 1
	return result
}

// EventBundle is a collection of events for sync
type EventBundle struct {
	ID        string    `json:"id"`
	From      string    `json:"from"`
	To        string    `json:"to,omitempty"`
	Events    []Event   `json:"events"`
	Timestamp int64     `json:"timestamp"`
	Checksum  string    `json:"checksum"`
	Signature []byte    `json:"signature"`
}

// CalculateChecksum computes a deterministic checksum
func (b *EventBundle) CalculateChecksum() string {
	// Sort events deterministically
	events := make([]Event, len(b.Events))
	copy(events, b.Events)
	sort.Slice(events, func(i, j int) bool {
		return events[i].ID < events[j].ID
	})
	
	data, _ := json.Marshal(struct {
		From      string  `json:"from"`
		To        string  `json:"to"`
		Events    []Event `json:"events"`
		Timestamp int64   `json:"timestamp"`
	}{
		From:      b.From,
		To:        b.To,
		Events:    events,
		Timestamp: b.Timestamp,
	})
	
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// Sign signs the bundle
func (b *EventBundle) Sign(privKey ed25519.PrivateKey) error {
	b.Checksum = b.CalculateChecksum()
	b.Timestamp = time.Now().UTC().Unix()
	
	data := b.signedData()
	b.Signature = ed25519.Sign(privKey, data)
	return nil
}

// Verify verifies the bundle signature
func (b *EventBundle) Verify(pubKey ed25519.PublicKey) bool {
	// Verify checksum
	if b.Checksum != b.CalculateChecksum() {
		return false
	}
	
	// Verify signature
	data := b.signedData()
	return ed25519.Verify(pubKey, data, b.Signature)
}

func (b *EventBundle) signedData() []byte {
	data, _ := json.Marshal(struct {
		ID       string `json:"id"`
		From     string `json:"from"`
		To       string `json:"to"`
		Checksum string `json:"checksum"`
		TS       int64  `json:"ts"`
	}{
		ID:       b.ID,
		From:     b.From,
		To:       b.To,
		Checksum: b.Checksum,
		TS:       b.Timestamp,
	})
	return data
}

// SyncState tracks synchronization state with peers
type SyncState struct {
	LastSync       int64       `json:"last_sync"`
	LastBundleID   string      `json:"last_bundle_id"`
	VectorClock    VectorClock `json:"vector_clock"`
	PendingEvents  []Event     `json:"pending_events"`
	ConflictCount  int         `json:"conflict_count"`
}

// SyncManager handles offline synchronization
type SyncManager struct {
	mu          sync.RWMutex
	config      *Config
	keyPair     *KeyPair
	peerStore   *PeerStore
	transport   *TransportManager
	
	// Local event log
	eventLog    []Event
	eventIndex  map[string]int // Event ID -> index
	vectorClock VectorClock
	
	// Sync state per peer
	peerSync    map[string]*SyncState
	
	// Handler for incoming events
	eventHandler func(Event) error
	
	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewSyncManager creates a sync manager
func NewSyncManager(config *Config, keyPair *KeyPair, peerStore *PeerStore, transport *TransportManager) *SyncManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &SyncManager{
		config:      config,
		keyPair:     keyPair,
		peerStore:   peerStore,
		transport:   transport,
		eventLog:    make([]Event, 0),
		eventIndex:  make(map[string]int),
		vectorClock: make(VectorClock),
		peerSync:    make(map[string]*SyncState),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start begins sync processes
func (s *SyncManager) Start() error {
	if !s.config.Sync.Enabled {
		return nil
	}
	
	// Register handler for event bundles
	s.transport.RegisterHandler(MsgTypeEventBundle, s.handleEventBundle)
	
	// Start sync loop
	s.wg.Add(1)
	go s.syncLoop()
	
	return nil
}

// Stop halts sync processes
func (s *SyncManager) Stop() {
	s.cancel()
	s.wg.Wait()
}

// CreateEvent creates and signs a new event
func (s *SyncManager) CreateEvent(eventType string, payload any) (*Event, error) {
	payloadData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Increment vector clock
	s.vectorClock = s.vectorClock.Increment(s.config.NodeID)
	
	event := Event{
		ID:        generateEventID(),
		Type:      eventType,
		Source:    s.config.NodeID,
		Timestamp: time.Now().UTC().Unix(),
		VectorClock: s.vectorClock.Merge(nil), // Copy current VC
		Payload:   payloadData,
	}
	
	// Sign event
	data := event.signedData()
	event.Signature = ed25519.Sign(s.keyPair.PrivateKey, data)
	
	// Add to local log
	s.appendEvent(event)
	
	return &event, nil
}

// GetEventsSince returns events after a given timestamp
func (s *SyncManager) GetEventsSince(since int64) []Event {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var result []Event
	for _, e := range s.eventLog {
		if e.Timestamp > since {
			result = append(result, e)
		}
	}
	return result
}

// GetEventsForPeer returns events a peer hasn't seen
func (s *SyncManager) GetEventsForPeer(peerID string) []Event {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	state, ok := s.peerSync[peerID]
	if !ok {
		// Peer hasn't synced, send all
		result := make([]Event, len(s.eventLog))
		copy(result, s.eventLog)
		return result
	}
	
	// Get events that happened after peer's vector clock
	var result []Event
	for _, e := range s.eventLog {
		if e.VectorClock.Compare(state.VectorClock) > 0 {
			result = append(result, e)
		}
	}
	return result
}

// CreateBundle creates a bundle for a specific peer
func (s *SyncManager) CreateBundle(peerID string) (*EventBundle, error) {
	events := s.GetEventsForPeer(peerID)
	
	// Check size limits
	if len(events) > s.config.Sync.BundleMaxEvents {
		events = events[len(events)-s.config.Sync.BundleMaxEvents:]
	}
	
	bundle := &EventBundle{
		ID:     generateBundleID(),
		From:   s.config.NodeID,
		To:     peerID,
		Events: events,
	}
	
	if err := bundle.Sign(s.keyPair.PrivateKey); err != nil {
		return nil, err
	}
	
	return bundle, nil
}

// SyncWithPeer performs sync with a specific peer
func (s *SyncManager) SyncWithPeer(peerID string) error {
	peer, ok := s.peerStore.Get(peerID)
	if !ok {
		return fmt.Errorf("peer not found: %s", peerID)
	}
	
	if !peer.CanDelegateTo() {
		return fmt.Errorf("peer not available for sync: %s", peerID)
	}
	
	bundle, err := s.CreateBundle(peerID)
	if err != nil {
		return err
	}
	
	// Don't send empty bundles
	if len(bundle.Events) == 0 {
		return nil
	}
	
	bundleData, err := json.Marshal(bundle)
	if err != nil {
		return err
	}
	
	msg := &Message{
		Type:    MsgTypeEventBundle,
		From:    s.config.NodeID,
		To:      peerID,
		Payload: bundleData,
		ID:      generateMessageID(),
	}
	
	if err := s.transport.Send(peerID, msg); err != nil {
		return err
	}
	
	// Update sync state
	s.mu.Lock()
	state := s.getOrCreateSyncState(peerID)
	state.LastBundleID = bundle.ID
	state.LastSync = time.Now().UTC().Unix()
	s.mu.Unlock()
	
	return nil
}

// handleEventBundle processes incoming event bundles
func (s *SyncManager) handleEventBundle(msg *Message, conn *Connection) {
	if msg.Payload == nil {
		return
	}
	
	var bundle EventBundle
	if err := json.Unmarshal(msg.Payload, &bundle); err != nil {
		return
	}
	
	// Verify bundle
	if s.config.Sync.VerifySignatures {
		peer, ok := s.peerStore.Get(bundle.From)
		if !ok {
			// Unknown peer
			return
		}
		
		if !bundle.Verify(peer.PeerPublicKey()) {
			// Invalid signature
			return
		}
	}
	
	// Process events
	s.mu.Lock()
	state := s.getOrCreateSyncState(bundle.From)
	conflicts := 0
	
	for _, event := range bundle.Events {
		// Check if we already have this event
		if _, exists := s.eventIndex[event.ID]; exists {
			continue
		}
		
		// Verify event signature
		if s.config.Sync.VerifySignatures {
			source, ok := s.peerStore.Get(event.Source)
			if !ok {
				// Unknown source, skip
				continue
			}
			
			if !event.Verify(source.PeerPublicKey()) {
				// Invalid event signature
				continue
			}
		}
		
		// Check for conflicts
		if s.hasConflict(event) {
			conflicts++
			s.resolveConflict(&event)
		}
		
		// Add to log
		s.appendEvent(event)
		
		// Update vector clock
		s.vectorClock = s.vectorClock.Merge(event.VectorClock)
		
		// Call handler if registered
		if s.eventHandler != nil {
			s.mu.Unlock()
			s.eventHandler(event)
			s.mu.Lock()
		}
	}
	
	state.LastSync = time.Now().UTC().Unix()
	state.VectorClock = s.vectorClock.Merge(nil)
	state.ConflictCount += conflicts
	s.mu.Unlock()
}

// hasConflict checks if an event conflicts with existing events
func (s *SyncManager) hasConflict(event Event) bool {
	// In append-only mode, no conflicts
	if s.config.Sync.ConflictResolution == "append_only" {
		return false
	}
	
	// For LWW mode, check if we have an event with same type/source
	if s.config.Sync.ConflictResolution == "lww" {
		for _, e := range s.eventLog {
			if e.Type == event.Type && e.Source == event.Source {
				// Conflict if timestamps differ
				if e.Timestamp != event.Timestamp {
					return true
				}
			}
		}
	}
	
	return false
}

// resolveConflict resolves a conflict based on configured strategy
func (s *SyncManager) resolveConflict(event *Event) {
	switch s.config.Sync.ConflictResolution {
	case "lww":
		// Last writer wins - handled by append ordering
	case "vector_clock":
		// Use vector clock comparison
		for _, e := range s.eventLog {
			if e.Type == event.Type && e.Source == event.Source {
				cmp := event.VectorClock.Compare(e.VectorClock)
				if cmp < 0 {
					// Existing event wins
					return
				}
			}
		}
	default:
		// Append-only: keep both
	}
}

// appendEvent adds an event to the log
func (s *SyncManager) appendEvent(event Event) {
	s.eventLog = append(s.eventLog, event)
	s.eventIndex[event.ID] = len(s.eventLog) - 1
}

// getOrCreateSyncState gets or creates sync state for a peer
func (s *SyncManager) getOrCreateSyncState(peerID string) *SyncState {
	state, ok := s.peerSync[peerID]
	if !ok {
		state = &SyncState{
			VectorClock: make(VectorClock),
		}
		s.peerSync[peerID] = state
	}
	return state
}

// syncLoop periodically syncs with peers
func (s *SyncManager) syncLoop() {
	defer s.wg.Done()
	
	if s.config.Sync.SyncInterval == 0 {
		return
	}
	
	ticker := time.NewTicker(s.config.Sync.SyncInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.syncWithAllPeers()
		}
	}
}

// syncWithAllPeers syncs with all trusted peers
func (s *SyncManager) syncWithAllPeers() {
	peers := s.peerStore.ListTrusted()
	
	// Limit concurrent syncs
	maxSync := s.config.Sync.MaxSyncPeers
	if maxSync <= 0 {
		maxSync = 5
	}
	
	if len(peers) > maxSync {
		peers = peers[:maxSync]
	}
	
	for _, peer := range peers {
		if err := s.SyncWithPeer(peer.NodeID); err != nil {
			// Log error, continue with other peers
			continue
		}
	}
}

// SetEventHandler sets the handler for incoming events
func (s *SyncManager) SetEventHandler(handler func(Event) error) {
	s.eventHandler = handler
}

// GetStats returns sync statistics
func (s *SyncManager) GetStats() SyncStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	totalConflicts := 0
	for _, state := range s.peerSync {
		totalConflicts += state.ConflictCount
	}
	
	return SyncStats{
		EventCount:     len(s.eventLog),
		PeerSyncCount:  len(s.peerSync),
		VectorClock:    s.vectorClock,
		TotalConflicts: totalConflicts,
	}
}

// SyncStats holds sync statistics
type SyncStats struct {
	EventCount     int         `json:"event_count"`
	PeerSyncCount  int         `json:"peer_sync_count"`
	VectorClock    VectorClock `json:"vector_clock"`
	TotalConflicts int         `json:"total_conflicts"`
}

// Event methods

func (e *Event) signedData() []byte {
	data, _ := json.Marshal(struct {
		ID      string          `json:"id"`
		Type    string          `json:"type"`
		Source  string          `json:"source"`
		TS      int64           `json:"ts"`
		VC      VectorClock     `json:"vc"`
		Payload json.RawMessage `json:"payload"`
	}{
		ID:      e.ID,
		Type:    e.Type,
		Source:  e.Source,
		TS:      e.Timestamp,
		VC:      e.VectorClock,
		Payload: e.Payload,
	})
	return data
}

// Verify checks the event signature
func (e *Event) Verify(pubKey ed25519.PublicKey) bool {
	if len(e.Signature) == 0 {
		return false
	}
	data := e.signedData()
	return ed25519.Verify(pubKey, data, e.Signature)
}

// ID generators

func generateEventID() string {
	return "evt_" + generateID()
}

func generateBundleID() string {
	return "bnd_" + generateID()
}

func generateID() string {
	b := make([]byte, 16)
	// In production use crypto/rand
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
