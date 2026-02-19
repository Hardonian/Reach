// Package poee provides mesh integration for Proof-of-Execution Exchange
package poee

import (
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"reach/services/runner/internal/mesh"
)

// MeshIntegration connects PoEE with the mesh networking layer
type MeshIntegration struct {
	keyStore  *KeyStore
	peerStore *mesh.PeerStore
	nodeID    string
}

// NewMeshIntegration creates a new mesh integration
func NewMeshIntegration(dataRoot string, peerStore *mesh.PeerStore, nodeID string) *MeshIntegration {
	return &MeshIntegration{
		keyStore:  NewKeyStore(dataRoot),
		peerStore: peerStore,
		nodeID:    nodeID,
	}
}

// LoadOrCreateKeyPair loads or creates the PoEE keypair
func (mi *MeshIntegration) LoadOrCreateKeyPair() (*KeyPair, error) {
	return mi.keyStore.LoadOrCreate()
}

// IsPeerTrusted checks if a peer is trusted for delegation
func (mi *MeshIntegration) IsPeerTrusted(nodeID string) bool {
	peer, ok := mi.peerStore.Get(nodeID)
	if !ok {
		return false
	}

	// Must be at least provisional trust level
	if peer.TrustLevel < mesh.TrustLevelProvisional {
		return false
	}

	// Must not be blocked or quarantined
	if peer.TrustLevel == mesh.TrustLevelBlocked || peer.Quarantined {
		return false
	}

	return true
}

// GetPeerPublicKey retrieves a peer's public key from mesh store
func (mi *MeshIntegration) GetPeerPublicKey(nodeID string) (ed25519.PublicKey, error) {
	peer, ok := mi.peerStore.Get(nodeID)
	if !ok {
		return nil, fmt.Errorf("peer %s not found", nodeID)
	}

	if len(peer.PublicKey) == 0 {
		return nil, fmt.Errorf("peer %s has no public key", nodeID)
	}

	return peer.PeerPublicKey(), nil
}

// SavePeerKeyFromMesh saves a peer's key from mesh to PoEE keystore
func (mi *MeshIntegration) SavePeerKeyFromMesh(nodeID string) error {
	peer, ok := mi.peerStore.Get(nodeID)
	if !ok {
		return fmt.Errorf("peer %s not found", nodeID)
	}

	if len(peer.PublicKey) == 0 {
		return fmt.Errorf("peer %s has no public key", nodeID)
	}

	return mi.keyStore.SavePeerKey(nodeID, peer.PeerPublicKey())
}

// RequireExplicitTrust ensures a peer has been explicitly trusted via pairing
func (mi *MeshIntegration) RequireExplicitTrust(nodeID string) error {
	if !mi.IsPeerTrusted(nodeID) {
		return fmt.Errorf("peer %s is not trusted - explicit pairing required", nodeID)
	}
	return nil
}

// TrustStoreManager manages the trust store integration
type TrustStoreManager struct {
	dataRoot string
	store    *TrustStore
}

// TrustStore maintains delegation trust state
type TrustStore struct {
	Delegations map[string]*DelegationTrustEntry `json:"delegations"`
}

// DelegationTrustEntry tracks trust state for a delegation
type DelegationTrustEntry struct {
	DelegationID  string `json:"delegation_id"`
	PeerID        string `json:"peer_id"`
	Status        string `json:"status"` // "pending", "completed", "failed"
	EnvelopedPath string `json:"enveloped_path,omitempty"`
	ProofPath     string `json:"proof_path,omitempty"`
	Verified      bool   `json:"verified"`
	FailureReason string `json:"failure_reason,omitempty"`
}

// NewTrustStoreManager creates a trust store manager
func NewTrustStoreManager(dataRoot string) *TrustStoreManager {
	return &TrustStoreManager{
		dataRoot: dataRoot,
		store: &TrustStore{
			Delegations: make(map[string]*DelegationTrustEntry),
		},
	}
}

// Load loads the trust store from disk
func (tsm *TrustStoreManager) Load() error {
	path := filepath.Join(tsm.dataRoot, ".reach", "trust_store.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return json.Unmarshal(data, tsm.store)
}

// Save persists the trust store to disk
func (tsm *TrustStoreManager) Save() error {
	path := filepath.Join(tsm.dataRoot, ".reach", "trust_store.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(tsm.store, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
}

// RecordDelegation records a new delegation
func (tsm *TrustStoreManager) RecordDelegation(delegationID, peerID string) error {
	tsm.store.Delegations[delegationID] = &DelegationTrustEntry{
		DelegationID: delegationID,
		PeerID:       peerID,
		Status:       "pending",
	}
	return tsm.Save()
}

// RecordCompletion records proof completion
func (tsm *TrustStoreManager) RecordCompletion(delegationID, proofPath string, verified bool) error {
	entry, ok := tsm.store.Delegations[delegationID]
	if !ok {
		return fmt.Errorf("delegation %s not found", delegationID)
	}

	entry.Status = "completed"
	entry.ProofPath = proofPath
	entry.Verified = verified
	return tsm.Save()
}

// RecordFailure records a delegation failure
func (tsm *TrustStoreManager) RecordFailure(delegationID, reason string) error {
	entry, ok := tsm.store.Delegations[delegationID]
	if !ok {
		return fmt.Errorf("delegation %s not found", delegationID)
	}

	entry.Status = "failed"
	entry.FailureReason = reason
	return tsm.Save()
}

// GetDelegation retrieves a delegation entry
func (tsm *TrustStoreManager) GetDelegation(delegationID string) (*DelegationTrustEntry, bool) {
	entry, ok := tsm.store.Delegations[delegationID]
	return entry, ok
}

// PeerListManager manages the list of available peers
type PeerListManager struct {
	peerStore *mesh.PeerStore
}

// NewPeerListManager creates a peer list manager
func NewPeerListManager(peerStore *mesh.PeerStore) *PeerListManager {
	return &PeerListManager{peerStore: peerStore}
}

// ListDelegatablePeers returns peers that can receive delegations
func (plm *PeerListManager) ListDelegatablePeers() []*mesh.PeerIdentity {
	allPeers := plm.peerStore.List()
	var delegatable []*mesh.PeerIdentity

	for _, peer := range allPeers {
		if peer.CanDelegateTo() {
			delegatable = append(delegatable, peer)
		}
	}

	return delegatable
}

// GetPeerInfo returns info about a specific peer
func (plm *PeerListManager) GetPeerInfo(nodeID string) (*mesh.PeerIdentity, bool) {
	return plm.peerStore.Get(nodeID)
}

// NoImplicitTrustError indicates missing explicit trust
type NoImplicitTrustError struct {
	NodeID string
}

func (e *NoImplicitTrustError) Error() string {
	return fmt.Sprintf("peer %s requires explicit trust pairing", e.NodeID)
}

// VerifyPeerTrust checks that a peer is explicitly trusted
func VerifyPeerTrust(peerStore *mesh.PeerStore, nodeID string) error {
	peer, ok := peerStore.Get(nodeID)
	if !ok {
		return &NoImplicitTrustError{NodeID: nodeID}
	}

	if peer.TrustLevel == mesh.TrustLevelUntrusted {
		return &NoImplicitTrustError{NodeID: nodeID}
	}

	if peer.TrustLevel == mesh.TrustLevelBlocked {
		return fmt.Errorf("peer %s is blocked", nodeID)
	}

	if peer.Quarantined {
		return fmt.Errorf("peer %s is quarantined: %s", nodeID, peer.QuarantineReason)
	}

	return nil
}
