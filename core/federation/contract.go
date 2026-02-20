package federation

import (
	"fmt"
	"sync"
	"time"
)

// Valid QoS tiers for capability contracts.
const (
	QoSBestEffort = "best-effort"
	QoSGuaranteed = "guaranteed"
	QoSRealTime   = "real-time"
)

// Valid verification methods.
const (
	VerifyMerkleProof  = "merkle-proof"
	VerifySignedReceipt = "signed-receipt"
)

// CapabilityContract defines the terms between a requester and a provider.
type CapabilityContract struct {
	ID                 string        `json:"id"`
	RequesterID        string        `json:"requester_id"`
	ProviderID         string        `json:"provider_id"`
	CapabilityID       string        `json:"capability_id"`
	QualityOfService   string        `json:"qos_tier"` // "best-effort", "guaranteed", "real-time"
	BudgetUSD          float64       `json:"budget_usd"`
	Timeout            time.Duration `json:"timeout"`
	VerificationMethod string        `json:"verification_method"` // "merkle-proof", "signed-receipt"
}

// Validate checks that a contract has all required fields and valid values.
func (c *CapabilityContract) Validate() error {
	if c.ID == "" {
		return fmt.Errorf("contract ID is required")
	}
	if c.RequesterID == "" || c.ProviderID == "" {
		return fmt.Errorf("requester and provider IDs are required")
	}
	if c.CapabilityID == "" {
		return fmt.Errorf("capability ID is required")
	}
	switch c.QualityOfService {
	case QoSBestEffort, QoSGuaranteed, QoSRealTime:
		// valid
	default:
		return fmt.Errorf("invalid QoS tier: %s (must be best-effort, guaranteed, or real-time)", c.QualityOfService)
	}
	if c.BudgetUSD < 0 {
		return fmt.Errorf("budget must be non-negative")
	}
	switch c.VerificationMethod {
	case VerifyMerkleProof, VerifySignedReceipt:
		// valid
	default:
		return fmt.Errorf("invalid verification method: %s", c.VerificationMethod)
	}
	return nil
}

// FederationState tracks the health and connectivity of peer systems.
type FederationState struct {
	Peers map[string]PeerInfo `json:"peers"`
}

// PeerInfo describes a federation peer.
type PeerInfo struct {
	ID            string    `json:"id"`
	Endpoint      string    `json:"endpoint"`
	Capabilities  []string  `json:"capabilities"`
	LastHeartbeat time.Time `json:"last_heartbeat"`
	Reputation    float64   `json:"reputation"`
}

// ContractManager manages the lifecycle of cross-system agreements.
type ContractManager struct {
	mu        sync.RWMutex
	contracts map[string]*CapabilityContract
}

// NewContractManager creates a new contract manager.
func NewContractManager() *ContractManager {
	return &ContractManager{
		contracts: make(map[string]*CapabilityContract),
	}
}

// ProposeContract initiates a new federation agreement after validation.
func (m *ContractManager) ProposeContract(contract *CapabilityContract) error {
	if contract == nil {
		return fmt.Errorf("contract is nil")
	}
	if err := contract.Validate(); err != nil {
		return fmt.Errorf("invalid contract: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.contracts[contract.ID]; exists {
		return fmt.Errorf("contract %s already exists", contract.ID)
	}
	m.contracts[contract.ID] = contract
	return nil
}

// GetContract retrieves a contract by ID.
func (m *ContractManager) GetContract(id string) (*CapabilityContract, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.contracts[id]
	return c, ok
}

// RevokeContract removes a contract by ID.
func (m *ContractManager) RevokeContract(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.contracts[id]; !exists {
		return fmt.Errorf("contract %s not found", id)
	}
	delete(m.contracts, id)
	return nil
}
