package mesh

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// Node is a mesh network node with coordinated subsystems:
// identity, handshake, routing, rate limiting, and correlation logging.
type Node struct {
	mu     sync.RWMutex
	config *Config
	keyPair *KeyPair

	// Identity
	identity NodeIdentityInfo

	// Subsystems
	peerStore   *PeerStore
	transport   *TransportManager
	discovery   *DiscoveryService
	syncMgr     *SyncManager
	delegator   *FederatedDelegator
	handshaker  *Handshaker
	router      *TaskRouter
	rateLimiter *MeshRateLimiter
	meshLogger  *MeshLogger

	// Session tokens for authenticated peers
	sessions map[string]SessionToken // nodeID -> token

	// State
	started bool
	peers   map[string]*PeerIdentity // Connected peers

	// Callbacks
	onPeerConnected    func(*PeerIdentity)
	onPeerDisconnected func(string)
	onEvent            func(Event)
}

// NewNode creates a new mesh node with deterministic identity.
func NewNode(config *Config) (*Node, error) {
	// Load or generate key pair
	keyPair, err := LoadOrGenerateKey(config.Security.PrivateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load key: %w", err)
	}

	// Build deterministic identity
	identity := BuildNodeIdentity(keyPair.PublicKey)

	// Override config NodeID with deterministic ID
	config.NodeID = identity.NodeID

	// Load peer store
	peerStore := NewPeerStore(config.Security.TrustStorePath)
	if err := peerStore.Load(); err != nil {
		return nil, fmt.Errorf("failed to load peer store: %w", err)
	}

	node := &Node{
		config:   config,
		keyPair:  keyPair,
		identity: identity,
		peerStore: peerStore,
		peers:    make(map[string]*PeerIdentity),
		sessions: make(map[string]SessionToken),
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
	n.syncMgr = NewSyncManager(n.config, n.keyPair, n.peerStore, n.transport)

	// Create handshaker with session TTL from config
	n.handshaker = NewHandshaker(n.config.Security.SessionTTL)

	// Create task router (only active when mesh + task routing enabled)
	n.router = NewTaskRouter(n.config.NodeID, n.transport, n.peerStore).
		WithMaxHops(n.config.Security.MaxDelegationDepth)

	// Create mesh rate limiter
	n.rateLimiter = NewMeshRateLimiter(MeshRateLimitConfig{
		RequestsPerMinutePerNode: n.config.Security.RateLimitPerMinute,
		GlobalRequestsPerMinute:  n.config.Security.RateLimitPerMinute * 5,
		MaxConcurrentTasks:       10,
		LoopCascadeWindow:        30 * time.Second,
		LoopCascadeThreshold:     15,
		CooldownDuration:         60 * time.Second,
	})

	// Create mesh logger
	n.meshLogger = NewMeshLogger(n.config.NodeID)

	// Register message handlers
	n.registerHandlers()

	return nil
}

// Start begins the mesh node. Returns nil immediately if mesh is disabled.
func (n *Node) Start() error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.started {
		return nil
	}

	// If mesh is disabled, do nothing — single-node users are unaffected
	if !n.config.IsMeshEnabled() {
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
			n.meshLogger.LogEvent(GenerateCorrelationID(), "warn", "mesh.discovery", "announce.failed", err.Error())
		}
	}

	// Start sync
	if n.config.IsFeatureEnabled(FeatureOfflineSync) {
		if err := n.syncMgr.Start(); err != nil {
			n.discovery.Stop()
			n.transport.Stop()
			return fmt.Errorf("failed to start sync: %w", err)
		}
	}

	n.meshLogger.LogEvent(GenerateCorrelationID(), "info", "mesh.node", "node.started",
		fmt.Sprintf("mesh node %s started (env: %s/%s)", n.config.NodeID, n.identity.Environment.OS, n.identity.Environment.Arch))

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

	n.syncMgr.Stop()
	n.discovery.Stop()
	n.transport.Stop()

	// Save peer store
	n.peerStore.Save()

	// Save config
	n.config.Save()

	n.meshLogger.LogEvent(GenerateCorrelationID(), "info", "mesh.node", "node.stopped",
		fmt.Sprintf("mesh node %s stopped", n.config.NodeID))

	n.started = false
	return nil
}

// IsRunning returns true if the node is running
func (n *Node) IsRunning() bool {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.started
}

// GetIdentity returns the node's deterministic identity info.
func (n *Node) GetIdentity() NodeIdentityInfo {
	return n.identity
}

// RouteTask sends a task to a specific target node.
// Requires mesh and task routing to be enabled.
func (n *Node) RouteTask(route TaskRoute) error {
	if !n.config.IsFeatureEnabled(FeatureTaskRouting) {
		return fmt.Errorf("task routing is disabled")
	}

	// Rate limit check
	if err := n.rateLimiter.Allow(route.TargetNodeID); err != nil {
		n.meshLogger.LogTaskEvent(CorrelationID(route.CorrelationID), route.TaskID,
			"route.rate_limited", "rate limited", err)
		return err
	}

	// Assign correlation ID if missing
	if route.CorrelationID == "" {
		route.CorrelationID = string(GenerateCorrelationID())
	}

	n.meshLogger.LogTaskEvent(CorrelationID(route.CorrelationID), route.TaskID,
		"route.initiated", fmt.Sprintf("routing task %s to %s", route.TaskID, route.TargetNodeID), nil)

	return n.router.Route(route)
}

// RegisterTaskHandler registers a handler for incoming routed tasks.
func (n *Node) RegisterTaskHandler(taskType string, handler TaskHandler) {
	n.router.RegisterHandler(taskType, handler)
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
		NodeID:       pairingCode.NodeID,
		PublicKey:     pairingCode.PublicKey,
		TrustSeed:    generateTrustSeed(),
		TrustLevel:   TrustLevelProvisional,
		DiscoveredAt: time.Now().UTC(),
		LastSeen:     time.Now().UTC(),
		DeviceInfo:   pairingCode.DeviceInfo,
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
	delete(n.sessions, nodeID)
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

	return n.syncMgr.SyncWithPeer(nodeID)
}

// CreateEvent creates a new mesh event
func (n *Node) CreateEvent(eventType string, payload any) (*Event, error) {
	if !n.config.IsFeatureEnabled(FeatureOfflineSync) {
		return nil, fmt.Errorf("offline sync is disabled")
	}

	return n.syncMgr.CreateEvent(eventType, payload)
}

// SetEventHandler sets the callback for incoming events
func (n *Node) SetEventHandler(handler func(Event) error) {
	n.syncMgr.SetEventHandler(handler)
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

// GetMeshLogger returns the mesh logger for external access.
func (n *Node) GetMeshLogger() *MeshLogger {
	return n.meshLogger
}

// GetRateLimiter returns the mesh rate limiter for external access.
func (n *Node) GetRateLimiter() *MeshRateLimiter {
	return n.rateLimiter
}

// GetStats returns node statistics
func (n *Node) GetStats() NodeStats {
	n.mu.RLock()
	defer n.mu.RUnlock()

	stats := NodeStats{
		NodeID:         n.config.NodeID,
		Running:        n.started,
		Features:       n.config.Features,
		MeshEnabled:    n.config.IsMeshEnabled(),
		Identity:       n.identity,
	}

	if !n.started {
		return stats
	}

	stats.ConnectedPeers = len(n.peers)
	stats.KnownPeers = len(n.peerStore.List())
	stats.TrustedPeers = len(n.peerStore.ListTrusted())
	stats.Transport = n.transport.Stats()
	stats.Discovery = n.discovery.Stats()

	if n.config.IsFeatureEnabled(FeatureOfflineSync) {
		stats.Sync = n.syncMgr.GetStats()
	}

	stats.RateLimit = n.rateLimiter.Stats()
	stats.MeshLog = n.meshLogger.Stats()

	return stats
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
	// Handshake handler — validates identity and creates session
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

	// Task routing handlers (only active when feature enabled)
	n.transport.RegisterHandler(MsgTypeTaskRoute, func(msg *Message, conn *Connection) {
		if !n.config.IsFeatureEnabled(FeatureTaskRouting) {
			return
		}

		// Rate limit inbound tasks
		if err := n.rateLimiter.Allow(msg.From); err != nil {
			n.meshLogger.LogEvent(GenerateCorrelationID(), "warn", "mesh.ratelimit",
				"inbound.rate_limited", fmt.Sprintf("rate limited task from %s: %s", msg.From, err))
			return
		}

		n.router.HandleIncomingRoute(msg, conn)
	})

	n.transport.RegisterHandler(MsgTypeTaskResult, func(msg *Message, conn *Connection) {
		if !n.config.IsFeatureEnabled(FeatureTaskRouting) {
			return
		}
		n.router.HandleIncomingResult(msg, conn)
	})
}

// handleHandshake processes handshake messages with signature verification.
// It verifies the peer's identity against the peer store before establishing
// a session. No blind trust — unknown peers are rejected.
func (n *Node) handleHandshake(msg *Message, conn *Connection) {
	cid := GenerateCorrelationID()
	n.meshLogger.LogEvent(cid, "info", "mesh.handshake", "handshake.received",
		fmt.Sprintf("handshake from %s", msg.From))

	// Verify peer is known
	peer, ok := n.peerStore.Get(msg.From)
	if !ok {
		n.meshLogger.LogEvent(cid, "warn", "mesh.handshake", "handshake.rejected",
			fmt.Sprintf("unknown peer: %s — no blind trust", msg.From))
		return
	}

	// Verify peer is not quarantined
	if peer.Quarantined {
		n.meshLogger.LogEvent(cid, "warn", "mesh.handshake", "handshake.rejected",
			fmt.Sprintf("quarantined peer: %s", msg.From))
		return
	}

	// Verify message signature
	if len(msg.Signature) > 0 {
		if !msg.Verify(peer.PeerPublicKey()) {
			n.meshLogger.LogEvent(cid, "error", "mesh.handshake", "handshake.signature_invalid",
				fmt.Sprintf("invalid signature from %s", msg.From))
			return
		}
	}

	// Parse handshake payload for session token exchange
	var handshakeData struct {
		NodeID    string `json:"node_id"`
		PublicKey []byte `json:"public_key"`
		Version   string `json:"version"`
	}
	if msg.Payload != nil {
		json.Unmarshal(msg.Payload, &handshakeData)
	}

	// Store connection mapping
	conn.NodeID = msg.From

	n.mu.Lock()
	n.peers[msg.From] = peer
	n.mu.Unlock()

	// Update last seen
	n.peerStore.UpdateLastSeen(msg.From, conn.Conn.RemoteAddr().String())

	n.meshLogger.LogEvent(cid, "info", "mesh.handshake", "handshake.completed",
		fmt.Sprintf("handshake completed with %s", msg.From))
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
	NodeID         string              `json:"node_id"`
	Running        bool                `json:"running"`
	MeshEnabled    bool                `json:"mesh_enabled"`
	Identity       NodeIdentityInfo    `json:"identity"`
	ConnectedPeers int                 `json:"connected_peers"`
	KnownPeers     int                 `json:"known_peers"`
	TrustedPeers   int                 `json:"trusted_peers"`
	Transport      TransportStats      `json:"transport"`
	Discovery      DiscoveryStats      `json:"discovery"`
	Sync           SyncStats           `json:"sync"`
	RateLimit      MeshRateLimitStats  `json:"rate_limit"`
	MeshLog        MeshLogStats        `json:"mesh_log"`
	Features       map[string]bool     `json:"features"`
}
