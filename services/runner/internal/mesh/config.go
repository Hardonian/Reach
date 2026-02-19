package mesh

import (
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// FeatureFlag controls mesh capabilities that can be enabled/disabled
type FeatureFlag string

const (
	// FeatureMDNS enables mDNS/Bonjour discovery on LAN
	FeatureMDNS FeatureFlag = "mdns_discovery"
	// FeatureQRPairing enables QR code and short code pairing
	FeatureQRPairing FeatureFlag = "qr_pairing"
	// FeaturePublicExposure allows accepting connections from non-LAN addresses
	FeaturePublicExposure FeatureFlag = "public_exposure"
	// FeatureOfflineSync enables peer-to-peer event bundle exchange
	FeatureOfflineSync FeatureFlag = "offline_sync"
	// FeatureMeshRouting enables routing through trusted peers
	FeatureMeshRouting FeatureFlag = "mesh_routing"
)

// DefaultFeatureStates defines safe-by-default feature states
var DefaultFeatureStates = map[FeatureFlag]bool{
	FeatureMDNS:           false, // Disabled by default - opt-in
	FeatureQRPairing:      true,  // Enabled for manual pairing
	FeaturePublicExposure: false, // NEVER enabled by default
	FeatureOfflineSync:    true,  // Enabled for local-first
	FeatureMeshRouting:    false, // Disabled until explicitly configured
}

// Config holds mesh configuration with safe defaults
type Config struct {
	mu       sync.RWMutex
	NodeID   string            `json:"node_id"`
	DataDir  string            `json:"-"`
	Features map[string]bool   `json:"features"`
	Network  NetworkConfig     `json:"network"`
	Security SecurityConfig    `json:"security"`
	Sync     SyncConfig        `json:"sync"`
	metadata map[string]string `json:"-"`
}

// NetworkConfig holds network-related settings
type NetworkConfig struct {
	ListenAddress      string        `json:"listen_address"`
	ListenPort         int           `json:"listen_port"`
	ExternalAddress    string        `json:"external_address,omitempty"`
	WebSocketEnabled   bool          `json:"websocket_enabled"`
	HTTPPollEnabled    bool          `json:"http_poll_enabled"`
	HTTPPollInterval   time.Duration `json:"http_poll_interval"`
	MaxConnections     int           `json:"max_connections"`
	ConnectionTimeout  time.Duration `json:"connection_timeout"`
	EnableIPv6         bool          `json:"enable_ipv6"`
	MulticastInterface string        `json:"multicast_interface,omitempty"`
}

// SecurityConfig holds security-related settings
type SecurityConfig struct {
	PrivateKeyPath      string        `json:"private_key_path"`
	TrustStorePath      string        `json:"trust_store_path"`
	MaxDelegationDepth  int           `json:"max_delegation_depth"`
	SessionTTL          time.Duration `json:"session_ttl"`
	PinCodeLength       int           `json:"pin_code_length"`
	RequirePinConfirm   bool          `json:"require_pin_confirm"`
	AutoAcceptTrusted   bool          `json:"auto_accept_trusted"`
	QuarantineThreshold int           `json:"quarantine_threshold"`
	RateLimitPerMinute  int           `json:"rate_limit_per_minute"`
}

// SyncConfig holds offline sync settings
type SyncConfig struct {
	Enabled            bool          `json:"enabled"`
	BundleMaxSize      int64         `json:"bundle_max_size_bytes"`
	BundleMaxEvents    int           `json:"bundle_max_events"`
	ConflictResolution string        `json:"conflict_resolution"` // "lww" | "vector_clock" | "append_only"
	SyncInterval       time.Duration `json:"sync_interval"`
	MaxSyncPeers       int           `json:"max_sync_peers"`
	VerifySignatures   bool          `json:"verify_signatures"`
}

// DefaultConfig returns a safe default configuration
func DefaultConfig(dataDir string) *Config {
	nodeID := generateNodeID()
	return &Config{
		NodeID:  nodeID,
		DataDir: dataDir,
		Features: map[string]bool{
			string(FeatureQRPairing):   true,
			string(FeatureOfflineSync): true,
		},
		Network: NetworkConfig{
			ListenAddress:     "0.0.0.0",
			ListenPort:        0, // Random available port
			WebSocketEnabled:  true,
			HTTPPollEnabled:   true,
			HTTPPollInterval:  30 * time.Second,
			MaxConnections:    50,
			ConnectionTimeout: 30 * time.Second,
			EnableIPv6:        false,
		},
		Security: SecurityConfig{
			PrivateKeyPath:      filepath.Join(dataDir, "mesh_key.pem"),
			TrustStorePath:      filepath.Join(dataDir, "trust_store.json"),
			MaxDelegationDepth:  5,
			SessionTTL:          5 * time.Minute,
			PinCodeLength:       6,
			RequirePinConfirm:   true,
			AutoAcceptTrusted:   false,
			QuarantineThreshold: 40,
			RateLimitPerMinute:  60,
		},
		Sync: SyncConfig{
			Enabled:            true,
			BundleMaxSize:      10 * 1024 * 1024, // 10MB
			BundleMaxEvents:    1000,
			ConflictResolution: "append_only",
			SyncInterval:       60 * time.Second,
			MaxSyncPeers:       5,
			VerifySignatures:   true,
		},
		metadata: make(map[string]string),
	}
}

// IsFeatureEnabled checks if a feature is enabled
func (c *Config) IsFeatureEnabled(flag FeatureFlag) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Check explicit setting first
	if enabled, ok := c.Features[string(flag)]; ok {
		return enabled
	}

	// Fall back to default
	return DefaultFeatureStates[flag]
}

// SetFeature enables or disables a feature
func (c *Config) SetFeature(flag FeatureFlag, enabled bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Features[string(flag)] = enabled
}

// Validate checks configuration safety
func (c *Config) Validate() error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Security checks
	if c.Security.MaxDelegationDepth < 1 || c.Security.MaxDelegationDepth > 10 {
		return fmt.Errorf("max_delegation_depth must be between 1 and 10")
	}

	if c.Security.PinCodeLength < 4 || c.Security.PinCodeLength > 12 {
		return fmt.Errorf("pin_code_length must be between 4 and 12")
	}

	// Network checks
	if c.Network.MaxConnections < 1 || c.Network.MaxConnections > 1000 {
		return fmt.Errorf("max_connections must be between 1 and 1000")
	}

	// Public exposure safety check
	if c.IsFeatureEnabled(FeaturePublicExposure) {
		// Require explicit acknowledgment in metadata
		if c.metadata["public_exposure_acknowledged"] != "true" {
			return fmt.Errorf("public_exposure feature requires explicit acknowledgment - set metadata public_exposure_acknowledged=true")
		}
	}

	return nil
}

// SetMetadata sets internal metadata (not persisted)
func (c *Config) SetMetadata(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.metadata == nil {
		c.metadata = make(map[string]string)
	}
	c.metadata[key] = value
}

// LoadConfig loads configuration from disk
func LoadConfig(dataDir string) (*Config, error) {
	path := filepath.Join(dataDir, "mesh_config.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Create default config
			cfg := DefaultConfig(dataDir)
			if err := cfg.Save(); err != nil {
				return nil, fmt.Errorf("failed to create default config: %w", err)
			}
			return cfg, nil
		}
		return nil, err
	}

	cfg := DefaultConfig(dataDir)
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("invalid config file: %w", err)
	}

	return cfg, nil
}

// Save persists configuration to disk
func (c *Config) Save() error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if err := os.MkdirAll(c.DataDir, 0o700); err != nil {
		return err
	}

	path := filepath.Join(c.DataDir, "mesh_config.json")
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	// Write with restricted permissions
	return os.WriteFile(path, data, 0o600)
}

// generateNodeID creates a unique node identifier
func generateNodeID() string {
	// Use crypto/rand in real implementation
	// For now, use timestamp-based ID
	return fmt.Sprintf("reach-%d", time.Now().UnixNano())
}

// KeyPair holds the node's cryptographic identity
type KeyPair struct {
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
}

// LoadOrGenerateKey loads existing key or generates new one
func LoadOrGenerateKey(path string) (*KeyPair, error) {
	// Try to load existing key
	if data, err := os.ReadFile(path); err == nil {
		privKey := ed25519.PrivateKey(data)
		if len(privKey) == ed25519.PrivateKeySize {
			return &KeyPair{
				PublicKey:  privKey.Public().(ed25519.PublicKey),
				PrivateKey: privKey,
			}, nil
		}
	}

	// Generate new key
	_, privKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	// Save with restricted permissions
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, privKey, 0o600); err != nil {
		return nil, err
	}

	return &KeyPair{
		PublicKey:  privKey.Public().(ed25519.PublicKey),
		PrivateKey: privKey,
	}, nil
}
