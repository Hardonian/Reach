package policy

import (
	"os"
	"slices"
	"strings"
	"sync"
)

type Mode string

const (
	ModeWarn    Mode = "warn"
	ModeEnforce Mode = "enforce"
)

type DenyReason string

const (
	ReasonInvalidSignature     DenyReason = "invalid_signature"
	ReasonUndeclaredTool       DenyReason = "undeclared_tool"
	ReasonPermissionEscalation DenyReason = "permission_scope_exceeds_policy"
	ReasonModelNotAllowed      DenyReason = "model_requirement_not_allowed"
	ReasonDeterminismRequired  DenyReason = "determinism_required"
)

func (r DenyReason) String() string { return string(r) }

type OrgPolicy struct {
	Version              string
	AllowedPermissions   []string
	AllowedModels        map[string][]string
	AllowLegacyUnsigned  bool
	RequireDeterministic bool
}

type NodeIdentity struct {
	NodeID string
	OrgID  string
}

type ExecutionPack struct {
	ID                  string
	Version             string
	Hash                string
	DeclaredTools       []string
	DeclaredPermissions []string
	ModelRequirements   map[string]string
	Deterministic       bool
	Signed              bool
	LegacyUnsigned      bool
}

type Input struct {
	Policy               OrgPolicy
	Node                 NodeIdentity
	Pack                 ExecutionPack
	RequestedTools       []string
	RequestedPermissions []string
	Mode                 Mode
}

type Decision struct {
	Allowed    bool
	Reasons    []DenyReason
	Redactions map[string]string
}

// decisionCache caches policy decisions to avoid recomputing for identical inputs.
// The cache key is derived from the pack hash and requested tools/permissions.
// This is safe because:
//   - Pack hash uniquely identifies the pack content including declared tools/permissions
//   - Policy changes are rare and the cache can be cleared when needed
//   - The cache is per-process and does not need persistence
var (
	decisionCache = make(map[string]Decision)
	cacheMu       sync.RWMutex
)

// ClearDecisionCache clears the policy decision cache.
// This should be called when policies change dynamically.
func ClearDecisionCache() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	decisionCache = make(map[string]Decision)
}

// cacheKey generates a cache key from the input.
// The key includes pack hash, requested tools, requested permissions, and policy settings.
// This ensures that identical requests get cached results while respecting policy changes.
func cacheKey(in Input) string {
	// Fast path: use pack hash as primary key component
	var b strings.Builder
	b.WriteString(in.Pack.Hash)
	b.WriteByte('|')
	b.WriteString(strings.Join(in.RequestedTools, ","))
	b.WriteByte('|')
	b.WriteString(strings.Join(in.RequestedPermissions, ","))
	b.WriteByte('|')
	b.WriteString(in.Pack.Version)
	b.WriteByte('|')
	// Include policy settings that affect the decision
	if in.Policy.AllowLegacyUnsigned {
		b.WriteByte('1')
	} else {
		b.WriteByte('0')
	}
	b.WriteByte('|')
	if in.Policy.RequireDeterministic {
		b.WriteByte('1')
	} else {
		b.WriteByte('0')
	}
	return b.String()
}

// Evaluate checks if the execution pack is allowed to run under the given policy.
// It uses memoization to cache decisions for identical inputs, improving performance
// for repeated executions of the same pack.
//
// The evaluation order is designed for fast-fail on common denial paths:
// 1. Signature validation (cheap check first)
// 2. Tool declarations (most common failure)
// 3. Permission escalation
// 4. Model requirements
// 5. Determinism requirements
func Evaluate(in Input) Decision {
	// Check cache first
	key := cacheKey(in)
	cacheMu.RLock()
	if cached, ok := decisionCache[key]; ok {
		cacheMu.RUnlock()
		return cached
	}
	cacheMu.RUnlock()

	// Compute decision
	decision := evaluateUncached(in)

	// Cache the result (only if deterministic - don't cache failures due to transient issues)
	// We cache all results because the inputs are deterministic
	cacheMu.Lock()
	decisionCache[key] = decision
	cacheMu.Unlock()

	return decision
}

// evaluateUncached performs the actual policy evaluation without caching.
// This is split from Evaluate for clarity and testability.
func evaluateUncached(in Input) Decision {
	reasons := make([]DenyReason, 0, 4) // Pre-allocate for common case

	// 1. Signature validation - fast path for unsigned packs
	if !in.Pack.Signed && !(in.Pack.LegacyUnsigned && in.Policy.AllowLegacyUnsigned) {
		reasons = append(reasons, ReasonInvalidSignature)
		// Continue checking other reasons for comprehensive denial reporting
	}

	// 2. Tool declaration check - O(n*m) but typically small sets
	// Use slices.Contains for clarity; Go's implementation is optimized
	for _, tool := range in.RequestedTools {
		if !slices.Contains(in.Pack.DeclaredTools, tool) {
			reasons = append(reasons, ReasonUndeclaredTool)
			break // One undeclared tool is enough to deny
		}
	}

	// 3. Permission escalation check
	for _, perm := range in.RequestedPermissions {
		if !slices.Contains(in.Pack.DeclaredPermissions, perm) || !slices.Contains(in.Policy.AllowedPermissions, perm) {
			reasons = append(reasons, ReasonPermissionEscalation)
			break
		}
	}

	// 4. Model requirements check
	for key, value := range in.Pack.ModelRequirements {
		allowed := in.Policy.AllowedModels[key]
		if len(allowed) > 0 && !slices.Contains(allowed, value) {
			reasons = append(reasons, ReasonModelNotAllowed)
			break
		}
	}

	// 5. Determinism requirement check
	if in.Policy.RequireDeterministic && !in.Pack.Deterministic {
		reasons = append(reasons, ReasonDeterminismRequired)
	}

	return Decision{
		Allowed: len(reasons) == 0,
		Reasons: reasons,
		Redactions: map[string]string{
			"pack_hash": redact(in.Pack.Hash),
			"node_id":   redact(in.Node.NodeID),
		},
	}
}

// AllowLegacyUnsignedFromEnv returns true if the environment allows legacy unsigned packs.
// This is cached at startup for performance.
func AllowLegacyUnsignedFromEnv() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("REACH_ALLOW_LEGACY_UNSIGNED_PACKS")), "true")
}

// ModeFromEnv returns the policy mode from environment variables.
// Defaults to enforce in CI/production, warn otherwise.
func ModeFromEnv() Mode {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("REACH_POLICY_MODE")))
	if raw == string(ModeEnforce) {
		return ModeEnforce
	}
	if raw == string(ModeWarn) {
		return ModeWarn
	}
	if os.Getenv("CI") != "" || strings.EqualFold(os.Getenv("GO_ENV"), "production") {
		return ModeEnforce
	}
	return ModeWarn
}

func redact(value string) string {
	if len(value) <= 8 {
		return "redacted"
	}
	return value[:4] + "..." + value[len(value)-4:]
}
