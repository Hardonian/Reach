package registry

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

// ExecutionPack represents an immutable, versioned bundle of intent and capabilities.
type ExecutionPack struct {
	Metadata            PackMetadata      `json:"metadata"`
	DeclaredTools       []string          `json:"declared_tools"`       // Whitelist of tools allowed
	DeclaredPermissions []string          `json:"declared_permissions"` // Whitelist of permissions
	ModelRequirements   map[string]string `json:"model_requirements"`   // e.g. { "tier": "high" }
	ExecutionGraph      *ExecutionGraph   `json:"execution_graph"`      // The blueprint/plan (refactored structure)
	DeterministicFlag   bool              `json:"deterministic"`        // Enforce deterministic seed/logic
	SignatureHash       string            `json:"signature_hash"`       // HMAC/Sig of the above fields
}

type PackMetadata struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Created     string `json:"created"` // ISO8601
}

// ComputeHash calculates the SHA256 hash of the pack content (excluding the signature itself).
func (p *ExecutionPack) ComputeHash() (string, error) {
	// Create a copy to exclude the signature
	clone := *p
	clone.SignatureHash = ""

	// Canonical JSON marshalling is hard in Go without a specialized library,
	// but for standard struct fields, standard json.Marshal is deterministic enough *if* keys are sorted.
	// Go's json.Marshal sorts map keys by default.
	data, err := json.Marshal(clone)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// ValidateIntegrity checks if the pack's SignatureHash matches its content.
func (p *ExecutionPack) ValidateIntegrity() error {
	if p.SignatureHash == "" {
		return errors.New("execution pack has no signature hash")
	}

	computed, err := p.ComputeHash()
	if err != nil {
		return fmt.Errorf("failed to compute hash: %w", err)
	}

	if computed != p.SignatureHash {
		return fmt.Errorf("integrity check failed: computed %s, expected %s", computed, p.SignatureHash)
	}
	return nil
}

// VerifyToolsDeclared ensures that a specific tool use is allowed by this pack.
func (p *ExecutionPack) VerifyToolAllowed(toolName string) bool {
	for _, t := range p.DeclaredTools {
		if t == toolName {
			return true
		}
	}
	return false
}

// VerifyPermissionDeclared ensures that a specific permission is allowed by this pack.
func (p *ExecutionPack) VerifyPermissionAllowed(perm string) bool {
	for _, p := range p.DeclaredPermissions {
		if p == perm {
			return true
		}
	}
	return false
}

// ValidateMarketplaceCompliance ensures that a pack destined for the marketplace meets safety criteria.
func (p *ExecutionPack) ValidateMarketplaceCompliance() error {
	// 1. Must declare required tools
	if len(p.DeclaredTools) == 0 {
		return errors.New("marketplace pack must declare required tools")
	}

	// 2. Must declare required permissions
	// (Empty is allowed if no permissions are needed, but explicit declaration is preferred)
	if p.DeclaredPermissions == nil {
		return errors.New("marketplace pack must explicitly declare permissions (even if empty)")

	}

	// 3. Sandboxed automatically - this is a runtime constraint, but we can check for forbidden high-risk permissions here
	for _, perm := range p.DeclaredPermissions {
		if perm == "sys:admin" || perm == "sys:exec" {
			// In a real scenario, this might be allowed only for "verified" authors,
			// but for generic marketplace compliance, we flag it.
			return fmt.Errorf("marketplace pack cannot request high-risk permission: %s", perm)
		}
	}

	// 4. Integrity check
	if err := p.ValidateIntegrity(); err != nil {
		return fmt.Errorf("marketplace pack integrity check failed: %w", err)
	}

	return nil
}
