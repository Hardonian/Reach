package registry

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"reach/services/runner/internal/spec"
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
	SpecVersion string `json:"spec_version,omitempty"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Created     string `json:"created"` // ISO8601
}

// packHashCache caches computed hashes to avoid recomputation.
// Key: pack.Metadata.ID+"@"+pack.Metadata.Version
// Value: computed hash
var packHashCache = make(map[string]string)

// ClearPackHashCache clears the pack hash cache.
// This should be called when packs are updated.
func ClearPackHashCache() {
	packHashCache = make(map[string]string)
}

// ComputeHash calculates the SHA256 hash of the pack content (excluding the signature itself).
// It uses deterministic JSON serialization to ensure consistent hashes across platforms.
// The result is cached to improve performance for repeated calls.
func (p *ExecutionPack) ComputeHash() (string, error) {
	// Check cache
	cacheKey := p.Metadata.ID + "@" + p.Metadata.Version
	if cached, ok := packHashCache[cacheKey]; ok {
		return cached, nil
	}

	// Create a copy to exclude the signature
	clone := *p
	clone.SignatureHash = ""

	// Use deterministic JSON marshalling
	// Go's json.Marshal sorts map keys by default, which provides determinism
	// for the Metadata and ModelRequirements fields.
	data, err := json.Marshal(clone)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(data)
	result := hex.EncodeToString(hash[:])

	// Cache the result
	packHashCache[cacheKey] = result

	return result, nil
}

// ValidateIntegrity checks if the pack's signature and spec-version contract match its content.
// It verifies:
//   - Spec version compatibility
//   - Presence of signature hash
//   - Hash integrity (computed hash matches stored signature)
func (p *ExecutionPack) ValidateIntegrity() error {
	if err := spec.CompatibleError(p.Metadata.SpecVersion); err != nil {
		return fmt.Errorf("execution pack spec compatibility failed: %w", err)
	}

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

// VerifyToolAllowed ensures that a specific tool use is allowed by this pack.
// Returns true if the tool is in the declared tools list.
func (p *ExecutionPack) VerifyToolAllowed(toolName string) bool {
	for _, t := range p.DeclaredTools {
		if t == toolName {
			return true
		}
	}
	return false
}

// VerifyPermissionAllowed ensures that a specific permission is allowed by this pack.
// Returns true if the permission is in the declared permissions list.
func (p *ExecutionPack) VerifyPermissionAllowed(perm string) bool {
	for _, p := range p.DeclaredPermissions {
		if p == perm {
			return true
		}
	}
	return false
}

// ValidateMarketplaceCompliance ensures that a pack destined for the marketplace meets safety criteria.
// It checks:
//   - Required tools are declared
//   - Permissions are explicitly declared (even if empty)
//   - No high-risk permissions are requested
//   - Integrity check passes
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
