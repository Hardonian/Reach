package mesh

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// TrustLevel represents the trust level of a peer
type TrustLevel int

const (
	TrustLevelUntrusted TrustLevel = iota
	TrustLevelProvisional // Paired but not fully verified
	TrustLevelTrusted     // Fully verified peer
	TrustLevelBlocked     // Explicitly blocked
)

func (t TrustLevel) String() string {
	switch t {
	case TrustLevelUntrusted:
		return "untrusted"
	case TrustLevelProvisional:
		return "provisional"
	case TrustLevelTrusted:
		return "trusted"
	case TrustLevelBlocked:
		return "blocked"
	default:
		return "unknown"
	}
}

// PeerIdentity represents a known peer in the mesh
type PeerIdentity struct {
	NodeID          string            `json:"node_id"`
	PublicKey       []byte            `json:"public_key"`
	TrustSeed       string            `json:"trust_seed"` // Derived from initial pairing
	TrustLevel      TrustLevel        `json:"trust_level"`
	DiscoveredAt    time.Time         `json:"discovered_at"`
	LastSeen        time.Time         `json:"last_seen"`
	LastAddress     string            `json:"last_address,omitempty"`
	DeviceInfo      DeviceInfo        `json:"device_info"`
	Capabilities    []string          `json:"capabilities"`
	Metadata        map[string]string `json:"metadata,omitempty"`
	Quarantined     bool              `json:"quarantined"`
	QuarantineReason string           `json:"quarantine_reason,omitempty"`
	DelegationCount int               `json:"delegation_count"`
	SuccessCount    int               `json:"success_count"`
	FailureCount    int               `json:"failure_count"`
}

// DeviceInfo contains device identification info
type DeviceInfo struct {
	DeviceName string `json:"device_name"`
	DeviceType string `json:"device_type"` // "mobile", "desktop", "server"
	OS         string `json:"os"`
	Version    string `json:"version"`
}

// PeerAddress represents a network address for a peer
type PeerAddress struct {
	Address   string    `json:"address"`
	Type      string    `json:"type"` // "websocket", "http", "relay"
	LastUsed  time.Time `json:"last_used"`
	LatencyMs int       `json:"latency_ms"`
	Healthy   bool      `json:"healthy"`
}

// PeerStore manages peer identities and trust
type PeerStore struct {
	mu      sync.RWMutex
	path    string
	peers   map[string]*PeerIdentity // keyed by node ID
	addresses map[string][]PeerAddress // keyed by node ID
}

// NewPeerStore creates a new peer store
func NewPeerStore(path string) *PeerStore {
	return &PeerStore{
		path:      path,
		peers:     make(map[string]*PeerIdentity),
		addresses: make(map[string][]PeerAddress),
	}
}

// Load reads peer store from disk
func (s *PeerStore) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	
	var stored struct {
		Peers     map[string]*PeerIdentity `json:"peers"`
		Addresses map[string][]PeerAddress `json:"addresses"`
	}
	
	if err := json.Unmarshal(data, &stored); err != nil {
		return fmt.Errorf("invalid peer store: %w", err)
	}
	
	s.peers = stored.Peers
	s.addresses = stored.Addresses
	
	if s.peers == nil {
		s.peers = make(map[string]*PeerIdentity)
	}
	if s.addresses == nil {
		s.addresses = make(map[string][]PeerAddress)
	}
	
	return nil
}

// Save persists peer store to disk
func (s *PeerStore) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	
	stored := struct {
		Peers     map[string]*PeerIdentity `json:"peers"`
		Addresses map[string][]PeerAddress `json:"addresses"`
	}{
		Peers:     s.peers,
		Addresses: s.addresses,
	}
	
	data, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(s.path, data, 0o600)
}

// Get retrieves a peer by node ID
func (s *PeerStore) Get(nodeID string) (*PeerIdentity, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.peers[nodeID]
	return p, ok
}

// GetByPublicKey finds peer by public key
func (s *PeerStore) GetByPublicKey(pubKey []byte) (*PeerIdentity, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	for _, p := range s.peers {
		if string(p.PublicKey) == string(pubKey) {
			return p, true
		}
	}
	return nil, false
}

// Put stores or updates a peer
func (s *PeerStore) Put(peer *PeerIdentity) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if peer.DiscoveredAt.IsZero() {
		peer.DiscoveredAt = time.Now().UTC()
	}
	
	s.peers[peer.NodeID] = peer
	return nil
}

// Remove deletes a peer
func (s *PeerStore) Remove(nodeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.peers, nodeID)
	delete(s.addresses, nodeID)
}

// List returns all peers
func (s *PeerStore) List() []*PeerIdentity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	list := make([]*PeerIdentity, 0, len(s.peers))
	for _, p := range s.peers {
		list = append(list, p)
	}
	return list
}

// ListTrusted returns only trusted peers
func (s *PeerStore) ListTrusted() []*PeerIdentity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var list []*PeerIdentity
	for _, p := range s.peers {
		if p.TrustLevel == TrustLevelTrusted && !p.Quarantined {
			list = append(list, p)
		}
	}
	return list
}

// UpdateLastSeen updates when a peer was last seen
func (s *PeerStore) UpdateLastSeen(nodeID, address string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if p, ok := s.peers[nodeID]; ok {
		p.LastSeen = time.Now().UTC()
		p.LastAddress = address
	}
}

// RecordDelegationResult records success/failure for reputation
func (s *PeerStore) RecordDelegationResult(nodeID string, success bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if p, ok := s.peers[nodeID]; ok {
		p.DelegationCount++
		if success {
			p.SuccessCount++
		} else {
			p.FailureCount++
		}
	}
}

// Quarantine marks a peer as quarantined
func (s *PeerStore) Quarantine(nodeID, reason string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if p, ok := s.peers[nodeID]; ok {
		p.Quarantined = true
		p.QuarantineReason = reason
	}
}

// IsQuarantined checks if a peer is quarantined
func (s *PeerStore) IsQuarantined(nodeID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if p, ok := s.peers[nodeID]; ok {
		return p.Quarantined
	}
	return false
}

// GetAddresses returns known addresses for a peer
func (s *PeerStore) GetAddresses(nodeID string) []PeerAddress {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.addresses[nodeID]
}

// AddAddress adds an address for a peer
func (s *PeerStore) AddAddress(nodeID string, addr PeerAddress) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Check if already exists
	for i, existing := range s.addresses[nodeID] {
		if existing.Address == addr.Address {
			s.addresses[nodeID][i] = addr
			return
		}
	}
	
	s.addresses[nodeID] = append(s.addresses[nodeID], addr)
}

// VerifyPeerSignature verifies a signature from a peer
func (s *PeerStore) VerifyPeerSignature(nodeID string, message, signature []byte) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	peer, ok := s.peers[nodeID]
	if !ok {
		return false
	}
	
	if len(peer.PublicKey) != ed25519.PublicKeySize {
		return false
	}
	
	return ed25519.Verify(peer.PublicKey, message, signature)
}

// PeerPublicKey returns the public key for a peer
func (p *PeerIdentity) PeerPublicKey() ed25519.PublicKey {
	return ed25519.PublicKey(p.PublicKey)
}

// PublicKeyHex returns hex-encoded public key
func (p *PeerIdentity) PublicKeyHex() string {
	return hex.EncodeToString(p.PublicKey)
}

// ShortID returns a shortened node ID for display
func (p *PeerIdentity) ShortID() string {
	if len(p.NodeID) > 12 {
		return p.NodeID[:12]
	}
	return p.NodeID
}

// TrustScore calculates a trust score based on history
func (p *PeerIdentity) TrustScore() int {
	if p.DelegationCount == 0 {
		if p.TrustLevel == TrustLevelTrusted {
			return 75 // Base score for trusted peers
		}
		return 50
	}
	
	successRate := float64(p.SuccessCount) / float64(p.DelegationCount)
	score := int(successRate * 100)
	
	if p.TrustLevel == TrustLevelTrusted {
		score += 10 // Bonus for explicit trust
	}
	
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	
	return score
}

// CanDelegateTo checks if this peer can be delegated to
func (p *PeerIdentity) CanDelegateTo() bool {
	if p.Quarantined {
		return false
	}
	if p.TrustLevel == TrustLevelBlocked {
		return false
	}
	if p.TrustLevel < TrustLevelProvisional {
		return false
	}
	return true
}

// PairingCode represents a short-lived pairing code
type PairingCode struct {
	Code        string    `json:"code"`
	NodeID      string    `json:"node_id"`
	PublicKey   []byte    `json:"public_key"`
	DeviceInfo  DeviceInfo `json:"device_info"`
	ExpiresAt   time.Time `json:"expires_at"`
	Used        bool      `json:"used"`
}

// GeneratePairingCode creates a new pairing code
func GeneratePairingCode(nodeID string, pubKey []byte, deviceInfo DeviceInfo, length int, ttl time.Duration) *PairingCode {
	// Generate random numeric code
	code := generateNumericCode(length)
	
	return &PairingCode{
		Code:       code,
		NodeID:     nodeID,
		PublicKey:  pubKey,
		DeviceInfo: deviceInfo,
		ExpiresAt:  time.Now().UTC().Add(ttl),
		Used:       false,
	}
}

// IsValid checks if the pairing code is still valid
func (pc *PairingCode) IsValid() bool {
	return !pc.Used && time.Now().UTC().Before(pc.ExpiresAt)
}

// ToQRData returns data suitable for encoding in QR code
func (pc *PairingCode) ToQRData() string {
	data := struct {
		Version    int        `json:"v"`
		NodeID     string     `json:"id"`
		PublicKey  string     `json:"pk"`
		DeviceName string     `json:"name"`
		DeviceType string     `json:"type"`
		Timestamp  int64      `json:"ts"`
	}{
		Version:    1,
		NodeID:     pc.NodeID,
		PublicKey:  base64.StdEncoding.EncodeToString(pc.PublicKey),
		DeviceName: pc.DeviceInfo.DeviceName,
		DeviceType: pc.DeviceInfo.DeviceType,
		Timestamp:  time.Now().UTC().Unix(),
	}
	
	b, _ := json.Marshal(data)
	return string(b)
}

// ParseQRData parses QR code data
func ParseQRData(qrData string) (*PairingCode, error) {
	var data struct {
		Version    int    `json:"v"`
		NodeID     string `json:"id"`
		PublicKey  string `json:"pk"`
		DeviceName string `json:"name"`
		DeviceType string `json:"type"`
		Timestamp  int64  `json:"ts"`
	}
	
	if err := json.Unmarshal([]byte(qrData), &data); err != nil {
		return nil, fmt.Errorf("invalid QR data: %w", err)
	}
	
	if data.Version != 1 {
		return nil, fmt.Errorf("unsupported QR version: %d", data.Version)
	}
	
	pubKey, err := base64.StdEncoding.DecodeString(data.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("invalid public key: %w", err)
	}
	
	return &PairingCode{
		NodeID:    data.NodeID,
		PublicKey: pubKey,
		DeviceInfo: DeviceInfo{
			DeviceName: data.DeviceName,
			DeviceType: data.DeviceType,
		},
	}, nil
}

// generateNumericCode generates a random numeric code
func generateNumericCode(length int) string {
	// In production, use crypto/rand
	// For now, generate deterministic code for testing
	chars := make([]byte, length)
	for i := 0; i < length; i++ {
		chars[i] = byte('0' + (time.Now().UnixNano() % 10))
	}
	return string(chars)
}
