package mesh

import (
	"context"
	"crypto/ed25519"
	"fmt"
	"sync"
	"time"
)

// Node is a mesh network node
type Node struct {
	mu          sync.RWMutex
	config      *Config
	keyPair     *KeyPair
	
	// Subsystems
	peerStore   *PeerStore
	transport   *TransportManager
	discovery   *DiscoveryService
	sync        *SyncManager
	delegator   *FederatedDelegator
	
	// State
	started     bool
	peers       map[string]*PeerIdentity // Connected peers
	
	// Callbacks
	onPeerConnected    func(*PeerIdentity)
	onPeerDisconnected func(string)
	onEvent            func(Event)
}

// NewNode creates a new mesh node
func NewNode(config *Config) (*Node, error) {
	// Load or generate key pair
	keyPair, err := LoadOrGenerateKey(config.Security.PrivateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load key: %w", err)
	}
	
	// Load peer store
	peerStore := NewPeerStore(config.Security.TrustStorePath)
	if err := peerStore.Load(); err != nil {
		return nil, fmt.Errorf("failed to load peer store: %w", err)
	}
	
	node := &Node{
		config:    config,
		keyPair:   keyPair,
		peerStore: peerStore,
		peers:     make(map[string]*PeerIdentity),
	}
	
	return node, nil
}

// Initialize sets up the node's subsystems
func (n *Node) Initialize(ctx context.Context) error {
	// Create transport manager
	n.transport = NewTransportManager(n.config, n.keyPair, n.peerStore)
	
	// Create discovery service
	n.discovery = NewDiscoveryService(n.config, n.keyPair)
	n.discovery.SetPeerHandler(n.handleDiscoveredPeer)
	
	// Create sync manager
	n.sync = NewSyncManager(n.config, n.keyPair, n.peerStore, n.transport)
	
	// Register message handlers
	n.registerHandlers()
	
	return nil
}

// Start begins the mesh node
func (n *Node) Start() error {
	n.mu.Lock()
	defer n.mu.Unlock()
	
	if n.started {
		return nil
	}
	
	// Validate config
	if err := n.config.Validate(); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}
	
	// Start transport
	if err := n.transport.Start(); err != nil {
		return fmt.Errorf("failed to start transport: %w", err)
	}
	
	// Start discovery
	if err := n.discovery.Start(); err != nil {
		n.transport.Stop()
		return fmt.Errorf("failed to start discovery: %w", err)
	}
	
	// Announce presence
	if n.config.IsFeatureEnabled(FeatureMDNS) {
		if err := n.discovery.Announce(); err != nil {
			// Log but don't fail
		}
	}
	
	// Start sync
	if n.config.IsFeatureEnabled(FeatureOfflineSync) {
		if err := n.sync.Start(); err != nil {
			n.discovery.Stop()
			n.transport.Stop()
			return fmt.Errorf("failed to start sync: %w", err)
		}
	}
	
	n.started = true
	return nil
}

// Stop halts the mesh node
func (n *Node) Stop() error {
	n.mu.Lock()
	defer n.mu.Unlock()
	
	if !n.started {
		return nil
	}
	
	n.sync.Stop()
	n.discovery.Stop()
	n.transport.Stop()
	
	// Save peer store
	n.peerStore.Save()
	
	// Save config
	n.config.Save()
	
	n.started = false
	return nil
}

// IsRunning returns true if the node is running
func (n *Node) IsRunning() bool {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.started
}

// Pair initiates pairing with another node using a code
func (n *Node) Pair(code string) (*PeerIdentity, error) {
	// Validate pairing code
	pairingCode, ok := n.discovery.ValidatePairingCode(code)
	if !ok {
		return nil, fmt.Errorf("invalid or expired pairing code")
	}
	
	// Verify we don't already have this peer
	if existing, ok := n.peerStore.Get(pairingCode.NodeID); ok {
		return existing, nil
	}
	
	// Create peer identity
	peer := &PeerIdentity{
		NodeID:     pairingCode.NodeID,
		PublicKey:  pairingCode.PublicKey,
		TrustSeed:  generateTrustSeed(),
		TrustLevel: TrustLevelProvisional,
		DiscoveredAt: time.Now().UTC(),
		LastSeen:   time.Now().UTC(),
		DeviceInfo: pairingCode.DeviceInfo,
	}
	
	// Store peer
	if err := n.peerStore.Put(peer); err != nil {
		return nil, err
	}
	
	// Mark code as used
	n.discovery.MarkPairingCodeUsed(code)
	
	// Try to connect
	if n.started {
		n.ConnectToPeer(peer.NodeID)
	}
	
	return peer, nil
}

// PairWithQR processes a QR code for pairing
func (n *Node) PairWithQR(qrData string) (*PeerIdentity, error) {
	event, err := n.discovery.ProcessQRCode(qrData)
	if err != nil {
		return nil, err
	}
	
	// Verify we don't already have this peer
	if existing, ok := n.peerStore.Get(event.NodeID); ok {
		return existing, nil
	}
	
	// Create peer identity
	peer := &PeerIdentity{
		NodeID:       event.NodeID,
		PublicKey:    event.PublicKey,
		TrustSeed:    generateTrustSeed(),
		TrustLevel:   TrustLevelProvisional,
		DiscoveredAt: time.Now().UTC(),
		LastSeen:     time.Now().UTC(),
		DeviceInfo:   event.DeviceInfo,
	}
	
	// Store peer
	if err := n.peerStore.Put(peer); err != nil {
		return nil, err
	}
	
	return peer, nil
}

// ConfirmPairing upgrades a provisional peer to trusted
func (n *Node) ConfirmPairing(nodeID string) error {
	peer, ok := n.peerStore.Get(nodeID)
	if !ok {
		return fmt.Errorf("peer not found: %s", nodeID)
	}
	
	if peer.TrustLevel != TrustLevelProvisional {
		return fmt.Errorf("peer not in provisional state")
	}
	
	peer.TrustLevel = TrustLevelTrusted
	return n.peerStore.Put(peer)
}

// RejectPairing blocks a peer
func (n *Node) RejectPairing(nodeID string) error {
	peer, ok := n.peerStore.Get(nodeID)
	if !ok {
		return fmt.Errorf("peer not found: %s", nodeID)
	}
	
	peer.TrustLevel = TrustLevelBlocked
	return n.peerStore.Put(peer)
}

// ConnectToPeer establishes a connection to a peer
func (n *Node) ConnectToPeer(nodeID string) error {
	peer, ok := n.peerStore.Get(nodeID)
	if !ok {
		return fmt.Errorf("peer not found: %s", nodeID)
	}
	
	if peer.Quarantined {
		return fmt.Errorf("peer is quarantined: %s", nodeID)
	}
	
	// Get peer addresses
	addresses := n.peerStore.GetAddresses(nodeID)
	if len(addresses) == 0 && peer.LastAddress != "" {
		addresses = append(addresses, PeerAddress{
			Address: peer.LastAddress,
			Type:    "websocket",
		})
	}
	
	if len(addresses) == 0 {
		return fmt.Errorf("no known addresses for peer: %s", nodeID)
	}
	
	// Try each address
	for _, addr := range addresses {
		conn, err := n.transport.Connect(addr.Address)
		if err != nil {
			continue
		}
		
		// Connection established
		conn.NodeID = nodeID
		n.mu.Lock()
		n.peers[nodeID] = peer
		n.mu.Unlock()
		
		n.peerStore.UpdateLastSeen(nodeID, addr.Address)
		
		if n.onPeerConnected != nil {
			n.onPeerConnected(peer)
		}
		
		return nil
	}
	
	return fmt.Errorf("could not connect to peer: %s", nodeID)
}

// DisconnectPeer closes connection to a peer
func (n *Node) DisconnectPeer(nodeID string) error {
	n.mu.Lock()
	delete(n.peers, nodeID)
	n.mu.Unlock()
	
	if n.onPeerDisconnected != nil {
		n.onPeerDisconnected(nodeID)
	}
	
	return nil
}

// GetPeers returns all connected peers
func (n *Node) GetPeers() []*PeerIdentity {
	n.mu.RLock()
	defer n.mu.RUnlock()
	
	peers := make([]*PeerIdentity, 0, len(n.peers))
	for _, p := range n.peers {
		peers = append(peers, p)
	}
	return peers
}

// GetTrustedPeers returns all trusted peers (connected or not)
func (n *Node) GetTrustedPeers() []*PeerIdentity {
	return n.peerStore.ListTrusted()
}

// GetAllPeers returns all known peers
func (n *Node) GetAllPeers() []*PeerIdentity {
	return n.peerStore.List()
}

// CreatePairingCode generates a new pairing code
func (n *Node) CreatePairingCode() *PairingCode {
	return n.discovery.CreatePairingCode()
}

// CreateQRCode generates QR code data for pairing
func (n *Node) CreateQRCode() string {
	return n.discovery.CreateQRCode()
}

// SyncWithPeer triggers sync with a specific peer
func (n *Node) SyncWithPeer(nodeID string) error {
	if !n.config.IsFeatureEnabled(FeatureOfflineSync) {
		return fmt.Errorf("offline sync is disabled")
	}
	
	return n.sync.SyncWithPeer(nodeID)
}

// CreateEvent creates a new mesh event
func (n *Node) CreateEvent(eventType string, payload any) (*Event, error) {
	if !n.config.IsFeatureEnabled(FeatureOfflineSync) {
		return nil, fmt.Errorf("offline sync is disabled")
	}
	
	return n.sync.CreateEvent(eventType, payload)
}

// SetEventHandler sets the callback for incoming events
func (n *Node) SetEventHandler(handler func(Event) error) {
	n.sync.SetEventHandler(handler)
}

// QuarantinePeer quarantines a peer
func (n *Node) QuarantinePeer(nodeID, reason string) error {
	n.peerStore.Quarantine(nodeID, reason)
	n.DisconnectPeer(nodeID)
	return nil
}

// IsPeerQuarantined checks if a peer is quarantined
func (n *Node) IsPeerQuarantined(nodeID string) bool {
	return n.peerStore.IsQuarantined(nodeID)
}

// GetPublicKey returns the node's public key
func (n *Node) GetPublicKey() ed25519.PublicKey {
	return n.keyPair.PublicKey
}

// GetNodeID returns the node ID
func (n *Node) GetNodeID() string {
	return n.config.NodeID
}

// GetStats returns node statistics
func (n *Node) GetStats() NodeStats {
	n.mu.RLock()
	defer n.mu.RUnlock()
	
	transportStats := n.transport.Stats()
	discoveryStats := n.discovery.Stats()
	
	var syncStats SyncStats
	if n.config.IsFeatureEnabled(FeatureOfflineSync) {
		syncStats = n.sync.GetStats()
	}
	
	return NodeStats{
		NodeID:          n.config.NodeID,
		Running:         n.started,
		ConnectedPeers:  len(n.peers),
		KnownPeers:      len(n.peerStore.List()),
		TrustedPeers:    len(n.peerStore.ListTrusted()),
		Transport:       transportStats,
		Discovery:       discoveryStats,
		Sync:            syncStats,
		Features:        n.config.Features,
	}
}

// SetFeature enables/disables a feature
func (n *Node) SetFeature(flag FeatureFlag, enabled bool) error {
	wasRunning := n.IsRunning()
	
	// Stop if running
	if wasRunning {
		n.Stop()
	}
	
	// Update feature
	n.config.SetFeature(flag, enabled)
	
	// Restart if was running
	if wasRunning {
		return n.Start()
	}
	
	return n.config.Save()
}

// IsFeatureEnabled checks if a feature is enabled
func (n *Node) IsFeatureEnabled(flag FeatureFlag) bool {
	return n.config.IsFeatureEnabled(flag)
}

// SetOnPeerConnected sets the peer connected callback
func (n *Node) SetOnPeerConnected(fn func(*PeerIdentity)) {
	n.onPeerConnected = fn
}

// SetOnPeerDisconnected sets the peer disconnected callback
func (n *Node) SetOnPeerDisconnected(fn func(string)) {
	n.onPeerDisconnected = fn
}

// handleDiscoveredPeer handles a newly discovered peer
func (n *Node) handleDiscoveredPeer(event DiscoveryEvent) {
	// Check if we know this peer
	if _, ok := n.peerStore.Get(event.NodeID); ok {
		// Update last seen
		n.peerStore.UpdateLastSeen(event.NodeID, event.Address)
		return
	}
	
	// Auto-accept if configured (not recommended)
	// Otherwise, require explicit pairing
}

// registerHandlers registers transport message handlers
func (n *Node) registerHandlers() {
	// Handshake handler
	n.transport.RegisterHandler(MsgTypeHandshake, n.handleHandshake)
	
	// Ping handler
	n.transport.RegisterHandler(MsgTypePing, func(msg *Message, conn *Connection) {
		pong := &Message{
			Type:    MsgTypePong,
			From:    n.config.NodeID,
			To:      msg.From,
			Payload: msg.Payload,
			ID:      generateMessageID(),
		}
		n.transport.Send(msg.From, pong)
	})
}

// handleHandshake processes handshake messages
func (n *Node) handleHandshake(msg *Message, conn *Connection) {
	// Verify peer identity
	// Store connection mapping
	conn.NodeID = msg.From
	
	n.mu.Lock()
	if peer, ok := n.peerStore.Get(msg.From); ok {
		n.peers[msg.From] = peer
	}
	n.mu.Unlock()
	
	// Update last seen
	n.peerStore.UpdateLastSeen(msg.From, conn.Conn.RemoteAddr().String())
}

// generateTrustSeed generates a trust seed for pairing
func generateTrustSeed() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
	}
	return fmt.Sprintf("%x", b)
}

// NodeStats holds node statistics
type NodeStats struct {
	NodeID         string            `json:"node_id"`
	Running        bool              `json:"running"`
	ConnectedPeers int               `json:"connected_peers"`
	KnownPeers     int               `json:"known_peers"`
	TrustedPeers   int               `json:"trusted_peers"`
	Transport      TransportStats    `json:"transport"`
	Discovery      DiscoveryStats    `json:"discovery"`
	Sync           SyncStats         `json:"sync"`
	Features       map[string]bool   `json:"features"`
}
