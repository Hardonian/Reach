package mesh

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// TransportType identifies the transport mechanism
type TransportType string

const (
	TransportWebSocket TransportType = "websocket"
	TransportHTTP      TransportType = "http"
)

// MessageType for transport messages
type MessageType string

const (
	MsgTypeHandshake   MessageType = "handshake"
	MsgTypePing        MessageType = "ping"
	MsgTypePong        MessageType = "pong"
	MsgTypeEventBundle MessageType = "event_bundle"
	MsgTypeDelegation  MessageType = "delegation"
	MsgTypeResponse    MessageType = "response"
	MsgTypeError       MessageType = "error"
	MsgTypeTaskRoute   MessageType = "task_route"
	MsgTypeTaskResult  MessageType = "task_result"
)

// Message is the envelope for all mesh communications
type Message struct {
	Type      MessageType     `json:"type"`
	From      string          `json:"from"`
	To        string          `json:"to,omitempty"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"ts"`
	Signature []byte          `json:"sig,omitempty"`
	ID        string          `json:"id"`
}

// SignedMessage adds signature to a message
type SignedMessage struct {
	Message
	Verified bool `json:"-"`
}

// Sign signs a message with the given private key
func (m *Message) Sign(privKey ed25519.PrivateKey) error {
	m.Timestamp = time.Now().UTC().Unix()
	data := m.signedData()
	m.Signature = ed25519.Sign(privKey, data)
	return nil
}

// Verify checks the signature on a message
func (m *Message) Verify(pubKey ed25519.PublicKey) bool {
	if len(m.Signature) == 0 {
		return false
	}
	data := m.signedData()
	return ed25519.Verify(pubKey, data, m.Signature)
}

func (m *Message) signedData() []byte {
	// Sign everything except the signature itself
	toSign := struct {
		Type    string          `json:"type"`
		From    string          `json:"from"`
		To      string          `json:"to"`
		Payload json.RawMessage `json:"payload"`
		ID      string          `json:"id"`
		TS      int64           `json:"ts"`
	}{
		Type:    string(m.Type),
		From:    m.From,
		To:      m.To,
		Payload: m.Payload,
		ID:      m.ID,
		TS:      m.Timestamp,
	}
	data, _ := json.Marshal(toSign)
	return data
}

// Connection represents a connection to a peer
type Connection struct {
	ID          string
	NodeID      string
	Type        TransportType
	Conn        net.Conn
	LastActive  time.Time
	Established time.Time
	mu          sync.Mutex
	writeMu     sync.Mutex
	closed      bool
	onClose     func()
}

// Write sends a message over the connection
func (c *Connection) Write(msg *Message) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if c.closed {
		return errors.New("connection closed")
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	// Add length prefix for framing
	frame := make([]byte, 4+len(data))
	frame[0] = byte(len(data) >> 24)
	frame[1] = byte(len(data) >> 16)
	frame[2] = byte(len(data) >> 8)
	frame[3] = byte(len(data))
	copy(frame[4:], data)

	if _, err := c.Conn.Write(frame); err != nil {
		return err
	}

	c.LastActive = time.Now().UTC()
	return nil
}

// Close closes the connection
func (c *Connection) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}

	c.closed = true
	err := c.Conn.Close()

	if c.onClose != nil {
		c.onClose()
	}

	return err
}

// IsClosed checks if connection is closed
func (c *Connection) IsClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

// TransportManager handles all peer connections
type TransportManager struct {
	mu        sync.RWMutex
	config    *Config
	keyPair   *KeyPair
	peerStore *PeerStore

	// Active connections
	connections map[string]*Connection // keyed by connection ID
	peers       map[string]string      // nodeID -> connection ID

	// HTTP fallback
	httpClient *http.Client
	httpServer *http.Server

	// Listeners
	listeners []net.Listener

	// Handlers
	handlers map[MessageType]func(*Message, *Connection)

	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Stats
	bytesIn  int64
	bytesOut int64
	msgsIn   int64
	msgsOut  int64
}

// NewTransportManager creates a transport manager
func NewTransportManager(config *Config, keyPair *KeyPair, peerStore *PeerStore) *TransportManager {
	ctx, cancel := context.WithCancel(context.Background())

	return &TransportManager{
		config:      config,
		keyPair:     keyPair,
		peerStore:   peerStore,
		connections: make(map[string]*Connection),
		peers:       make(map[string]string),
		httpClient: &http.Client{
			Timeout: config.Network.ConnectionTimeout,
		},
		handlers: make(map[MessageType]func(*Message, *Connection)),
		ctx:      ctx,
		cancel:   cancel,
	}
}

// RegisterHandler registers a message handler
func (t *TransportManager) RegisterHandler(msgType MessageType, handler func(*Message, *Connection)) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.handlers[msgType] = handler
}

// Start begins listening for connections
func (t *TransportManager) Start() error {
	// Start WebSocket listener
	if t.config.Network.WebSocketEnabled {
		if err := t.startWebSocketListener(); err != nil {
			return fmt.Errorf("failed to start WebSocket listener: %w", err)
		}
	}

	// Start HTTP fallback listener
	if t.config.Network.HTTPPollEnabled {
		if err := t.startHTTPListener(); err != nil {
			return fmt.Errorf("failed to start HTTP listener: %w", err)
		}
	}

	// Start connection maintenance
	t.wg.Add(1)
	go t.maintenanceLoop()

	return nil
}

// Stop shuts down all connections
func (t *TransportManager) Stop() error {
	t.cancel()

	// Close all connections
	t.mu.Lock()
	for _, conn := range t.connections {
		conn.Close()
	}
	t.mu.Unlock()

	// Close listeners
	for _, ln := range t.listeners {
		ln.Close()
	}

	// Shutdown HTTP server
	if t.httpServer != nil {
		t.httpServer.Shutdown(context.Background())
	}

	t.wg.Wait()
	return nil
}

// Connect establishes a connection to a peer
func (t *TransportManager) Connect(address string) (*Connection, error) {
	// Check if already connected
	t.mu.RLock()
	for _, connID := range t.peers {
		if conn, ok := t.connections[connID]; ok {
			if conn.Conn.RemoteAddr().String() == address {
				t.mu.RUnlock()
				return conn, nil
			}
		}
	}
	t.mu.RUnlock()

	// Try WebSocket first
	conn, err := t.dialWebSocket(address)
	if err == nil {
		return conn, nil
	}

	// Fall back to HTTP polling if enabled
	if t.config.Network.HTTPPollEnabled {
		return t.dialHTTP(address)
	}

	return nil, err
}

// Send sends a message to a specific peer
func (t *TransportManager) Send(nodeID string, msg *Message) error {
	// Sign the message
	if err := msg.Sign(t.keyPair.PrivateKey); err != nil {
		return err
	}

	// Find connection
	t.mu.RLock()
	connID, ok := t.peers[nodeID]
	if !ok {
		t.mu.RUnlock()
		return fmt.Errorf("no connection to peer %s", nodeID)
	}
	conn, ok := t.connections[connID]
	t.mu.RUnlock()

	if !ok || conn.IsClosed() {
		return fmt.Errorf("connection to peer %s is closed", nodeID)
	}

	if err := conn.Write(msg); err != nil {
		return err
	}

	atomic.AddInt64(&t.msgsOut, 1)
	return nil
}

// Broadcast sends a message to all connected peers
func (t *TransportManager) Broadcast(msg *Message) []error {
	// Sign once
	if err := msg.Sign(t.keyPair.PrivateKey); err != nil {
		return []error{err}
	}

	t.mu.RLock()
	connections := make([]*Connection, 0, len(t.connections))
	for _, conn := range t.connections {
		connections = append(connections, conn)
	}
	t.mu.RUnlock()

	var errs []error
	for _, conn := range connections {
		if !conn.IsClosed() {
			if err := conn.Write(msg); err != nil {
				errs = append(errs, fmt.Errorf("failed to send to %s: %w", conn.NodeID, err))
			} else {
				atomic.AddInt64(&t.msgsOut, 1)
			}
		}
	}

	return errs
}

// startWebSocketListener starts the WebSocket server
func (t *TransportManager) startWebSocketListener() error {
	ln, err := net.Listen("tcp", fmt.Sprintf("%s:%d", t.config.Network.ListenAddress, t.config.Network.ListenPort))
	if err != nil {
		return err
	}

	t.listeners = append(t.listeners, ln)

	t.wg.Add(1)
	go t.acceptLoop(ln)

	// Update config with actual port if random
	if t.config.Network.ListenPort == 0 {
		addr := ln.Addr().(*net.TCPAddr)
		t.config.Network.ListenPort = addr.Port
	}

	return nil
}

// startHTTPListener starts the HTTP fallback server
func (t *TransportManager) startHTTPListener() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/mesh/poll", t.handleHTTPPoll)
	mux.HandleFunc("/mesh/push", t.handleHTTPPush)
	mux.HandleFunc("/mesh/health", t.handleHealth)

	port := t.config.Network.ListenPort + 1 // HTTP on next port
	if port == 1 {
		port = 8080
	}

	t.httpServer = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", t.config.Network.ListenAddress, port),
		Handler: mux,
	}

	t.wg.Add(1)
	go func() {
		defer t.wg.Done()
		t.httpServer.ListenAndServe()
	}()

	return nil
}

// acceptLoop accepts incoming connections
func (t *TransportManager) acceptLoop(ln net.Listener) {
	defer t.wg.Done()

	for {
		conn, err := ln.Accept()
		if err != nil {
			select {
			case <-t.ctx.Done():
				return
			default:
				continue
			}
		}

		t.wg.Add(1)
		go t.handleConnection(conn)
	}
}

// handleConnection handles a new incoming connection
func (t *TransportManager) handleConnection(conn net.Conn) {
	defer t.wg.Done()

	connection := &Connection{
		ID:          generateConnectionID(),
		Type:        TransportWebSocket,
		Conn:        conn,
		LastActive:  time.Now().UTC(),
		Established: time.Now().UTC(),
	}

	// Perform handshake
	nodeID, err := t.performServerHandshake(connection)
	if err != nil {
		conn.Close()
		return
	}

	connection.NodeID = nodeID
	connection.onClose = func() {
		t.removeConnection(connection.ID)
	}

	// Register connection
	t.registerConnection(connection)

	// Start read loop
	t.readLoop(connection)
}

// readLoop reads messages from a connection
func (t *TransportManager) readLoop(conn *Connection) {
	defer conn.Close()

	for {
		select {
		case <-t.ctx.Done():
			return
		default:
		}

		// Read length prefix
		lenBuf := make([]byte, 4)
		if _, err := io.ReadFull(conn.Conn, lenBuf); err != nil {
			return
		}

		msgLen := int(lenBuf[0])<<24 | int(lenBuf[1])<<16 | int(lenBuf[2])<<8 | int(lenBuf[3])
		if msgLen > 10*1024*1024 { // 10MB max
			return
		}

		// Read message
		msgBuf := make([]byte, msgLen)
		if _, err := io.ReadFull(conn.Conn, msgBuf); err != nil {
			return
		}

		var msg Message
		if err := json.Unmarshal(msgBuf, &msg); err != nil {
			continue
		}

		atomic.AddInt64(&t.msgsIn, 1)
		atomic.AddInt64(&t.bytesIn, int64(msgLen))
		conn.LastActive = time.Now().UTC()

		// Handle message
		t.handleMessage(&msg, conn)
	}
}

// handleMessage processes an incoming message
func (t *TransportManager) handleMessage(msg *Message, conn *Connection) {
	// Verify signature if present
	if len(msg.Signature) > 0 && conn.NodeID != "" {
		if peer, ok := t.peerStore.Get(conn.NodeID); ok {
			if !msg.Verify(peer.PeerPublicKey()) {
				// Invalid signature
				t.sendError(conn, "invalid signature")
				return
			}
		}
	}

	// Route to handler
	t.mu.RLock()
	handler, ok := t.handlers[msg.Type]
	t.mu.RUnlock()

	if ok {
		handler(msg, conn)
	}
}

// handleHTTPPoll handles HTTP polling requests
func (t *TransportManager) handleHTTPPoll(w http.ResponseWriter, r *http.Request) {
	// Long-polling endpoint for messages
	// In production, would maintain a queue per peer
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}

// handleHTTPPush handles incoming messages via HTTP
func (t *TransportManager) handleHTTPPush(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var msg Message
	if err := json.Unmarshal(body, &msg); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	// Handle message
	// In production, would queue for processing
	_ = msg

	w.WriteHeader(http.StatusOK)
}

// handleHealth handles health check requests
func (t *TransportManager) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := map[string]any{
		"status":    "healthy",
		"node_id":   t.config.NodeID,
		"timestamp": time.Now().UTC().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// performServerHandshake handles server-side handshake
func (t *TransportManager) performServerHandshake(conn *Connection) (string, error) {
	// Send challenge
	challenge := &HandshakeChallenge{
		NodeID:    t.config.NodeID,
		Timestamp: time.Now().UTC().Unix(),
		Nonce:     base64.RawURLEncoding.EncodeToString(generateNonce()),
	}

	challengeData, _ := json.Marshal(challenge)
	msg := &Message{
		Type:    MsgTypeHandshake,
		From:    t.config.NodeID,
		Payload: challengeData,
		ID:      generateMessageID(),
	}

	if err := conn.Write(msg); err != nil {
		return "", err
	}

	// Wait for response (simplified - would use timeout)
	// In production, implement proper timeout and response handling

	return "", nil
}

// dialWebSocket connects via WebSocket
func (t *TransportManager) dialWebSocket(address string) (*Connection, error) {
	conn, err := net.DialTimeout("tcp", address, t.config.Network.ConnectionTimeout)
	if err != nil {
		return nil, err
	}

	connection := &Connection{
		ID:          generateConnectionID(),
		Type:        TransportWebSocket,
		Conn:        conn,
		LastActive:  time.Now().UTC(),
		Established: time.Now().UTC(),
	}

	// Perform client handshake
	if err := t.performClientHandshake(connection); err != nil {
		conn.Close()
		return nil, err
	}

	connection.onClose = func() {
		t.removeConnection(connection.ID)
	}

	t.registerConnection(connection)

	// Start read loop
	t.wg.Add(1)
	go t.readLoop(connection)

	return connection, nil
}

// dialHTTP connects via HTTP polling
func (t *TransportManager) dialHTTP(address string) (*Connection, error) {
	// In production, implement HTTP long-polling
	return nil, errors.New("HTTP fallback not yet implemented")
}

// performClientHandshake handles client-side handshake
func (t *TransportManager) performClientHandshake(conn *Connection) error {
	// Send our handshake info
	handshake := &HandshakeInfo{
		NodeID:    t.config.NodeID,
		PublicKey: t.keyPair.PublicKey,
		Version:   "1.0",
	}

	data, _ := json.Marshal(handshake)
	sig := ed25519.Sign(t.keyPair.PrivateKey, data)

	info := &ClientHandshake{
		Info:      handshake,
		Signature: sig,
	}

	infoData, _ := json.Marshal(info)
	msg := &Message{
		Type:    MsgTypeHandshake,
		From:    t.config.NodeID,
		Payload: infoData,
		ID:      generateMessageID(),
	}

	return conn.Write(msg)
}

// registerConnection adds a connection to the map
func (t *TransportManager) registerConnection(conn *Connection) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.connections[conn.ID] = conn
	if conn.NodeID != "" {
		t.peers[conn.NodeID] = conn.ID
	}
}

// removeConnection removes a connection
func (t *TransportManager) removeConnection(connID string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if conn, ok := t.connections[connID]; ok {
		delete(t.connections, connID)
		if conn.NodeID != "" {
			delete(t.peers, conn.NodeID)
		}
	}
}

// maintenanceLoop handles periodic tasks
func (t *TransportManager) maintenanceLoop() {
	defer t.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
			t.cleanupStaleConnections()
		}
	}
}

// cleanupStaleConnections removes inactive connections
func (t *TransportManager) cleanupStaleConnections() {
	t.mu.Lock()
	defer t.mu.Unlock()

	timeout := t.config.Network.ConnectionTimeout
	now := time.Now().UTC()

	for id, conn := range t.connections {
		if now.Sub(conn.LastActive) > timeout*2 {
			conn.Close()
			delete(t.connections, id)
			if conn.NodeID != "" {
				delete(t.peers, conn.NodeID)
			}
		}
	}
}

// sendError sends an error response
func (t *TransportManager) sendError(conn *Connection, errMsg string) {
	payload, _ := json.Marshal(map[string]string{"error": errMsg})
	msg := &Message{
		Type:    MsgTypeError,
		From:    t.config.NodeID,
		Payload: payload,
		ID:      generateMessageID(),
	}
	conn.Write(msg)
}

// Stats returns transport statistics
func (t *TransportManager) Stats() TransportStats {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return TransportStats{
		Connections: len(t.connections),
		Peers:       len(t.peers),
		BytesIn:     atomic.LoadInt64(&t.bytesIn),
		BytesOut:    atomic.LoadInt64(&t.bytesOut),
		MsgsIn:      atomic.LoadInt64(&t.msgsIn),
		MsgsOut:     atomic.LoadInt64(&t.msgsOut),
	}
}

// TransportStats holds transport metrics
type TransportStats struct {
	Connections int   `json:"connections"`
	Peers       int   `json:"peers"`
	BytesIn     int64 `json:"bytes_in"`
	BytesOut    int64 `json:"bytes_out"`
	MsgsIn      int64 `json:"msgs_in"`
	MsgsOut     int64 `json:"msgs_out"`
}

// Handshake types
type HandshakeChallenge struct {
	NodeID    string `json:"node_id"`
	Timestamp int64  `json:"timestamp"`
	Nonce     string `json:"nonce"`
}

type HandshakeInfo struct {
	NodeID    string `json:"node_id"`
	PublicKey []byte `json:"public_key"`
	Version   string `json:"version"`
}

type ClientHandshake struct {
	Info      *HandshakeInfo `json:"info"`
	Signature []byte         `json:"signature"`
}

// generateConnectionID creates a unique connection ID
func generateConnectionID() string {
	return base64.RawURLEncoding.EncodeToString(generateNonce())
}

// generateMessageID creates a unique message ID
func generateMessageID() string {
	return base64.RawURLEncoding.EncodeToString(generateNonce())
}

// generateNonce creates a random nonce
func generateNonce() []byte {
	b := make([]byte, 16)
	// In production use crypto/rand
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
	}
	return b
}
