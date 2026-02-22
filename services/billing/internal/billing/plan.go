// Package billing provides billing tier management.
//
// DEPRECATED: This service is frozen as of OSS pivot. See plans/OSS_REFINEMENT_PLAN.md
// Features previously gated by billing tiers are now controlled via feature flags.
// Use reach/core/config/features for feature access checks.
package billing

import "strings"

// PlanTier represents a billing plan tier.
// DEPRECATED: Billing tiers are no longer used for feature gating.
type PlanTier string

const (
	Free       PlanTier = "free"
	Pro        PlanTier = "pro"
	Enterprise PlanTier = "enterprise"
)

// Features represents the feature set for a billing tier.
// DEPRECATED: Use feature flags from reach/core/config/features instead.
type Features struct {
	LocalOnly       bool
	HostedRunner    bool
	Collaboration   bool
	SSO             bool
	ComplianceLogs  bool
	NodeFederation  bool
	MaxSpawnDepth   int
	UnlimitedSpawns bool
}

// ParseTier parses a string into a PlanTier.
// DEPRECATED: Billing tiers are no longer used for feature gating.
func ParseTier(raw string) PlanTier {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "pro":
		return Pro
	case "enterprise":
		return Enterprise
	default:
		return Free
	}
}

// FeatureSet returns the feature set for a given tier.
// DEPRECATED: Use feature flags from reach/core/config/features instead.
func FeatureSet(tier PlanTier, enterpriseDepth int) Features {
	switch tier {
	case Pro:
		return Features{HostedRunner: true, Collaboration: true, MaxSpawnDepth: 2}
	case Enterprise:
		depth := enterpriseDepth
		if depth <= 0 {
			depth = 32
		}
		return Features{HostedRunner: true, Collaboration: true, SSO: true, ComplianceLogs: true, NodeFederation: true, MaxSpawnDepth: depth, UnlimitedSpawns: true}
	default:
		return Features{LocalOnly: true, MaxSpawnDepth: 1}
	}
}
	case Pro:
		return Features{HostedRunner: true, Collaboration: true, MaxSpawnDepth: 2}
	case Enterprise:
		depth := enterpriseDepth
		if depth <= 0 {
			depth = 32
		}
		return Features{HostedRunner: true, Collaboration: true, SSO: true, ComplianceLogs: true, NodeFederation: true, MaxSpawnDepth: depth, UnlimitedSpawns: true}
	default:
		return Features{LocalOnly: true, MaxSpawnDepth: 1}
	}
}

