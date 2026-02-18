package mesh

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

// DiscoveryMethod represents how a peer was discovered
type DiscoveryMethod string

const (
	DiscoveryMDNS    DiscoveryMethod = "mdns"
	DiscoveryQR      DiscoveryMethod = "qr"
	DiscoveryPin     DiscoveryMethod = "pin"
	DiscoveryManual  DiscoveryMethod = "manual"
	DiscoveryRelay   DiscoveryMethod = "relay"
)

// DiscoveryEvent is emitted when a peer is discovered
type DiscoveryEvent struct {
	NodeID      string          `json:"node_id"`
	Address     string          `json:"address"`
	PublicKey   []byte          `json:"public_key"`
	DeviceInfo  DeviceInfo      `json:"device_info"`
	Method      DiscoveryMethod `json:"method"`
	Timestamp   time.Time       `json:"timestamp"`
	TTL         time.Duration   `json:"ttl"`
}

// DiscoveryService handles peer discovery
type DiscoveryService struct {
	mu       sync.RWMutex
	config   *Config
	keyPair  *KeyPair
	onPeer   func(DiscoveryEvent)
	
	// mDNS fields (stub for actual implementation)
	mdnsEnabled bool
	mdnsServer  *mdnsServer
	
	// Pairing codes
	pairingCodes map[string]*PairingCode // keyed by code
	
	// Context for shutdown
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// mdnsServer is a placeholder for mDNS implementation
type mdnsServer struct {
	serviceName string
	port        int
}

// NewDiscoveryService creates a discovery service
func NewDiscoveryService(config *Config, keyPair *KeyPair) *DiscoveryService {
	ctx, cancel := context.WithCancel(context.Background())
	return &DiscoveryService{
		config:       config,
		keyPair:      keyPair,
		pairingCodes: make(map[string]*PairingCode),
		ctx:          ctx,
		cancel:       cancel,
	}
}

// SetPeerHandler sets the callback for discovered peers
func (d *DiscoveryService) SetPeerHandler(handler func(DiscoveryEvent)) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.onPeer = handler
}

// Start begins discovery services
func (d *DiscoveryService) Start() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	// Start mDNS if enabled
	if d.config.IsFeatureEnabled(FeatureMDNS) {
		if err := d.startMDNS(); err != nil {
			return fmt.Errorf("failed to start mDNS: %w", err)
		}
		d.mdnsEnabled = true
	}
	
	// Start cleanup goroutine for expired pairing codes
	d.wg.Add(1)
	go d.cleanupLoop()
	
	return nil
}

// Stop halts discovery services
func (d *DiscoveryService) Stop() error {
	d.cancel()
	
	d.mu.Lock()
	if d.mdnsServer != nil {
		d.stopMDNS()
	}
	d.mu.Unlock()
	
	d.wg.Wait()
	return nil
}

// CreatePairingCode generates a new pairing code
func (d *DiscoveryService) CreatePairingCode() *PairingCode {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	deviceInfo := DeviceInfo{
		DeviceName: d.config.NodeID[:8],
		DeviceType: "desktop", // Should be detected
		OS:         detectOS(),
		Version:    "1.0",
	}
	
	code := GeneratePairingCode(
		d.config.NodeID,
		d.keyPair.PublicKey,
		deviceInfo,
		d.config.Security.PinCodeLength,
		5*time.Minute,
	)
	
	d.pairingCodes[code.Code] = code
	return code
}

// CreateQRCode generates QR code data for pairing
func (d *DiscoveryService) CreateQRCode() string {
	code := d.CreatePairingCode()
	return code.ToQRData()
}

// ValidatePairingCode checks if a code is valid
func (d *DiscoveryService) ValidatePairingCode(code string) (*PairingCode, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	pc, ok := d.pairingCodes[code]
	if !ok {
		return nil, false
	}
	
	if !pc.IsValid() {
		delete(d.pairingCodes, code)
		return nil, false
	}
	
	return pc, true
}

// MarkPairingCodeUsed marks a code as consumed
func (d *DiscoveryService) MarkPairingCodeUsed(code string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	if pc, ok := d.pairingCodes[code]; ok {
		pc.Used = true
	}
}

// ProcessQRCode processes a scanned QR code
func (d *DiscoveryService) ProcessQRCode(qrData string) (*DiscoveryEvent, error) {
	code, err := ParseQRData(qrData)
	if err != nil {
		return nil, err
	}
	
	return &DiscoveryEvent{
		NodeID:     code.NodeID,
		PublicKey:  code.PublicKey,
		DeviceInfo: code.DeviceInfo,
		Method:     DiscoveryQR,
		Timestamp:  time.Now().UTC(),
	}, nil
}

// Announce broadcasts our presence (mDNS or broadcast)
func (d *DiscoveryService) Announce() error {
	if !d.config.IsFeatureEnabled(FeatureMDNS) {
		return nil
	}
	
	return d.announceMDNS()
}

// startMDNS initializes mDNS service
func (d *DiscoveryService) startMDNS() error {
	// In a real implementation, this would:
	// 1. Register a mDNS service (_reach._tcp.local.)
	// 2. Broadcast node ID, public key hash, and port
	// 3. Listen for peer announcements
	// 4. Verify signatures before accepting
	
	// Stub implementation
	d.mdnsServer = &mdnsServer{
		serviceName: fmt.Sprintf("%s._reach._tcp.local.", d.config.NodeID),
		port:        d.config.Network.ListenPort,
	}
	
	return nil
}

// stopMDNS shuts down mDNS service
func (d *DiscoveryService) stopMDNS() {
	if d.mdnsServer != nil {
		// Unregister service
		d.mdnsServer = nil
	}
}

// announceMDNS broadcasts presence via mDNS
func (d *DiscoveryService) announceMDNS() error {
	if d.mdnsServer == nil {
		return fmt.Errorf("mDNS not started")
	}
	
	// Broadcast TXT record with:
	// - Node ID
	// - Public key hash (for verification)
	// - Capabilities
	// - Port
	
	return nil
}

// cleanupLoop removes expired pairing codes
func (d *DiscoveryService) cleanupLoop() {
	defer d.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			d.cleanupExpiredCodes()
		}
	}
}

// cleanupExpiredCodes removes old pairing codes
func (d *DiscoveryService) cleanupExpiredCodes() {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	now := time.Now().UTC()
	for code, pc := range d.pairingCodes {
		if now.After(pc.ExpiresAt) || pc.Used {
			delete(d.pairingCodes, code)
		}
	}
}

// IsLANAddress checks if an address is on the local network
func IsLANAddress(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	
	// Check private IP ranges
	privateBlocks := []*net.IPNet{
		parseCIDR("10.0.0.0/8"),
		parseCIDR("172.16.0.0/12"),
		parseCIDR("192.168.0.0/16"),
		parseCIDR("127.0.0.0/8"),
		parseCIDR("fc00::/7"),  // IPv6 unique local
		parseCIDR("fe80::/10"), // IPv6 link-local
	}
	
	for _, block := range privateBlocks {
		if block.Contains(ip) {
			return true
		}
	}
	
	return false
}

func parseCIDR(s string) *net.IPNet {
	_, ipnet, _ := net.ParseCIDR(s)
	return ipnet
}

// detectOS detects the operating system
func detectOS() string {
	// In production, use runtime.GOOS or similar
	return "unknown"
}

// PeerAnnouncement is broadcast during discovery
type PeerAnnouncement struct {
	Version        int      `json:"v"`
	NodeID         string   `json:"node_id"`
	PublicKeyHash  string   `json:"pk_hash"`
	ListenPort     int      `json:"port"`
	Capabilities   []string `json:"caps"`
	Timestamp      int64    `json:"ts"`
	DeviceType     string   `json:"device_type"`
	Signature      []byte   `json:"sig"`
}

// SignAnnouncement creates a signed announcement
func SignAnnouncement(nodeID string, pubKey ed25519.PublicKey, listenPort int, capabilities []string, privateKey ed25519.PrivateKey) (*PeerAnnouncement, error) {
	announcement := &PeerAnnouncement{
		Version:      1,
		NodeID:       nodeID,
		PublicKeyHash: hashKey(pubKey),
		ListenPort:   listenPort,
		Capabilities: capabilities,
		Timestamp:    time.Now().UTC().Unix(),
		DeviceType:   detectOS(),
	}
	
	// Sign the announcement
	data, err := json.Marshal(struct {
		NodeID     string   `json:"node_id"`
		Port       int      `json:"port"`
		Caps       []string `json:"caps"`
		Timestamp  int64    `json:"ts"`
	}{
		NodeID:    announcement.NodeID,
		Port:      announcement.ListenPort,
		Caps:      announcement.Capabilities,
		Timestamp: announcement.Timestamp,
	})
	if err != nil {
		return nil, err
	}
	
	announcement.Signature = ed25519.Sign(privateKey, data)
	return announcement, nil
}

// VerifyAnnouncement checks if an announcement is valid
func VerifyAnnouncement(ann *PeerAnnouncement, pubKey ed25519.PublicKey) bool {
	// Check timestamp (prevent replay attacks)
	age := time.Since(time.Unix(ann.Timestamp, 0))
	if age < 0 || age > 5*time.Minute {
		return false
	}
	
	// Verify public key hash matches
	if ann.PublicKeyHash != hashKey(pubKey) {
		return false
	}
	
	// Verify signature
	data, err := json.Marshal(struct {
		NodeID    string   `json:"node_id"`
		Port      int      `json:"port"`
		Caps      []string `json:"caps"`
		Timestamp int64    `json:"ts"`
	}{
		NodeID:    ann.NodeID,
		Port:      ann.ListenPort,
		Caps:      ann.Capabilities,
		Timestamp: ann.Timestamp,
	})
	if err != nil {
		return false
	}
	
	return ed25519.Verify(pubKey, data, ann.Signature)
}

func hashKey(key []byte) string {
	hash := sha256.Sum256(key)
	return hex.EncodeToString(hash[:8])
}

// DiscoveryStats holds discovery statistics
type DiscoveryStats struct {
	MDNSEnabled     bool      `json:"mdns_enabled"`
	PairingActive   int       `json:"active_pairing_codes"`
	PeersDiscovered int       `json:"peers_discovered"`
	LastScan        time.Time `json:"last_scan,omitempty"`
}

// Stats returns current discovery statistics
func (d *DiscoveryService) Stats() DiscoveryStats {
	d.mu.RLock()
	defer d.mu.RUnlock()
	
	active := 0
	for _, pc := range d.pairingCodes {
		if pc.IsValid() && !pc.Used {
			active++
		}
	}
	
	return DiscoveryStats{
		MDNSEnabled:     d.mdnsEnabled,
		PairingActive:   active,
		PeersDiscovered: 0, // Would track actual discoveries
	}
}


