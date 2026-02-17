package billing

import "strings"

type PlanTier string

const (
	Free       PlanTier = "free"
	Pro        PlanTier = "pro"
	Enterprise PlanTier = "enterprise"
)

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
