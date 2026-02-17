package tier

import "strings"

type Plan string

const (
	PlanFree       Plan = "free"
	PlanPro        Plan = "pro"
	PlanEnterprise Plan = "enterprise"
)

type Feature string

const (
	FeatureRepoMetadataOnly Feature = "repo_metadata_only"
	FeatureRepoDiffSync     Feature = "repo_diff_sync"
	FeatureRepoFullSync     Feature = "repo_full_sync"
	FeatureCloudConfigSync  Feature = "cloud_config_sync"
	FeatureHostedNodeRoute  Feature = "hosted_node_route"
	FeatureSpawnDepthGtOne  Feature = "spawn_depth_gt_one"
	FeatureCollaboration    Feature = "collaboration"
)

func ParsePlan(raw string) Plan {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(PlanPro):
		return PlanPro
	case string(PlanEnterprise):
		return PlanEnterprise
	default:
		return PlanFree
	}
}

func Allows(plan Plan, feature Feature) bool {
	switch feature {
	case FeatureRepoMetadataOnly:
		return true
	case FeatureRepoDiffSync, FeatureCloudConfigSync, FeatureHostedNodeRoute, FeatureSpawnDepthGtOne, FeatureCollaboration:
		return plan == PlanPro || plan == PlanEnterprise
	case FeatureRepoFullSync:
		return plan == PlanEnterprise
	default:
		return false
	}
}
