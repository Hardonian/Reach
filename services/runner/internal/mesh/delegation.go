package mesh

import (
	"context"
	"errors"
	"fmt"
	"reach/services/runner/internal/federation"
	"reach/services/runner/internal/registry"
	"reach/services/runner/internal/spec"
	"sync"
	"time"
)

// DelegationRequest defines the protocol for offloading a pack execution to another node.
type DelegationRequest struct {
	Pack            registry.ExecutionPack  `json:"pack"`
	RunID           string                  `json:"run_id"`
	GlobalRunID     string                  `json:"global_run_id"`
	OriginNodeID    string                  `json:"origin_node_id"`
	Deterministic   bool                    `json:"deterministic"`
	DelegationDepth int                     `json:"delegation_depth"`
	TTL             time.Duration           `json:"ttl"`
	PolicyVersion   string                  `json:"policy_version"`
	RegistryHash    string                  `json:"registry_hash"`
	SpecVersion     string                  `json:"spec_version"`
	Identity        federation.NodeIdentity `json:"identity"`
}

// DelegationResponse captures the outcome of a delegation request.
type DelegationResponse struct {
	Status          string `json:"status"`
	ExecutionNodeID string `json:"execution_node_id"`
	Error           string `json:"error,omitempty"`
}

// FederatedDelegator handles outgoing and incoming delegation requests.
type FederatedDelegator struct {
	mu                  sync.Mutex
	localNodeID         string
	maxDepth            int
	registry            registry.Registry
	registrySnapshotID  string
	circuitOpen         map[string]bool
	failureCounts       map[string]int
	quarantined         map[string]bool
	quarantineThreshold int
	audit               func(event string, req DelegationRequest, err error)
}

func NewFederatedDelegator(nodeID string, reg registry.Registry) *FederatedDelegator {
	return &FederatedDelegator{
		localNodeID:         nodeID,
		maxDepth:            5,
		registry:            reg,
		circuitOpen:         make(map[string]bool),
		failureCounts:       make(map[string]int),
		quarantined:         make(map[string]bool),
		quarantineThreshold: 40,
	}
}

func (d *FederatedDelegator) WithAuditSink(fn func(event string, req DelegationRequest, err error)) *FederatedDelegator {
	d.audit = fn
	return d
}

func (d *FederatedDelegator) WithRegistrySnapshotHash(hash string) *FederatedDelegator {
	d.registrySnapshotID = hash
	return d
}

// AcceptDelegation processes an incoming delegation request.
func (d *FederatedDelegator) AcceptDelegation(ctx context.Context, req DelegationRequest) (DelegationResponse, error) {
	d.emit("delegation.received", req, nil)

	// 1. Guardrails (Phase 4)
	if req.DelegationDepth >= d.maxDepth {
		err := errors.New("max delegation depth exceeded")
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: err.Error()}, err
	}

	if err := ctx.Err(); err != nil {
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: err.Error()}, err
	}

	if d.registrySnapshotID != "" && req.RegistryHash != d.registrySnapshotID {
		err := errors.New("registry snapshot hash mismatch")
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: err.Error()}, err
	}

	if req.OriginNodeID == d.localNodeID {
		err := errors.New("recursive delegation detected")
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: err.Error()}, err
	}

	if err := spec.CompatibleError(req.SpecVersion); err != nil {
		d.quarantineNode(req.OriginNodeID)
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: err.Error()}, err
	}

	// 2. Re-Validate Pack (Phase 2)
	if err := req.Pack.ValidateIntegrity(); err != nil {
		d.RecordFailure(req.OriginNodeID)
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: "invalid pack signature"}, err
	}

	if err := d.registry.ValidatePackCompatibility(req.Pack); err != nil {
		d.RecordFailure(req.OriginNodeID)
		d.emit("delegation.rejected", req, err)
		return DelegationResponse{Status: "rejected", Error: "incompatible pack version"}, err
	}

	// 3. Replay Integrity Check (Phase 3)
	// In a real system, we'd check if this GlobalRunID has been seen with a different registry hash
	// For now, we validate against our local capability capability set if deterministic is requested.
	if req.Deterministic {
		// Mock check: in production we verify if our local registry supports everything the pack needs deterministically
		// (This is partially handled by ValidatePackCompatibility)
	}

	d.emit("delegation.accepted", req, nil)
	return DelegationResponse{
		Status:          "accepted",
		ExecutionNodeID: d.localNodeID,
	}, nil
}

func (d *FederatedDelegator) emit(event string, req DelegationRequest, err error) {
	if d.audit != nil {
		d.audit(event, req, err)
	}
}

// FailureContainer implements circuit breaker logic (Phase 4)
func (d *FederatedDelegator) RecordFailure(nodeID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.failureCounts[nodeID]++
	if d.failureCounts[nodeID] > 5 {
		d.circuitOpen[nodeID] = true
		d.quarantined[nodeID] = true
		fmt.Printf("Circuit breaker OPEN for node %s\n", nodeID)
		time.AfterFunc(1*time.Minute, func() {
			d.mu.Lock()
			defer d.mu.Unlock()
			d.circuitOpen[nodeID] = false
			d.failureCounts[nodeID] = 0
			fmt.Printf("Circuit breaker CLOSED for node %s\n", nodeID)
		})
	}
}

func (d *FederatedDelegator) IsNodeHealthy(nodeID string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return !d.circuitOpen[nodeID] && !d.quarantined[nodeID]
}

func (d *FederatedDelegator) quarantineNode(nodeID string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.quarantined[nodeID] = true
}
