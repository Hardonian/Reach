// Package features provides feature flag management for the OSS pivot.
//
// Features previously gated by billing tiers are now controlled via this
// configuration system. Use environment variable REACH_FEATURE_FLAGS to enable
// features (comma-separated list).
package features

import (
	"os"
	"strings"
	"sync"
)

// Feature represents a feature that can be enabled via feature flags.
type Feature string

const (
	// FeatureSSO enables Single Sign-On functionality.
	FeatureSSO Feature = "enable_sso"
	// FeatureComplianceLogs enables compliance logging.
	FeatureComplianceLogs Feature = "enable_compliance_logs"
	// FeatureNodeFederation enables node federation for distributed execution.
	FeatureNodeFederation Feature = "enable_node_federation"
	// FeatureCollaboration enables real-time collaboration features.
	FeatureCollaboration Feature = "enable_collaboration"
	// FeatureHostedRunner enables hosted execution runners.
	FeatureHostedRunner Feature = "enable_hosted_runner"
	// FeatureAdvancedSpawn enables spawn depth greater than 1.
	FeatureAdvancedSpawn Feature = "enable_advanced_spawn"
)

var (
	// enabledFeatures stores which features are enabled
	enabledFeatures map[Feature]bool
	// once ensures initialization happens only once
	once sync.Once
)

// initFeatures parses the REACH_FEATURE_FLAGS environment variable and
// initializes the enabled features map.
func initFeatures() {
	enabledFeatures = make(map[Feature]bool)
	flags := os.Getenv("REACH_FEATURE_FLAGS")
	if flags == "" {
		return
	}
	for _, f := range strings.Split(flags, ",") {
		f = strings.TrimSpace(f)
		if f == "" {
			continue
		}
		enabledFeatures[Feature(f)] = true
	}
}

// IsEnabled checks if a feature is enabled.
// Thread-safe and lazily initialized.
func IsEnabled(f Feature) bool {
	once.Do(initFeatures)
	return enabledFeatures[f]
}

// GetEnabledFeatures returns a slice of all currently enabled features.
// Useful for debugging and logging.
func GetEnabledFeatures() []Feature {
	once.Do(initFeatures)
	result := make([]Feature, 0, len(enabledFeatures))
	for f, enabled := range enabledFeatures {
		if enabled {
			result = append(result, f)
		}
	}
	return result
}

// MustGet returns the feature constant for a string name,
// panicking if the feature is not recognized.
func MustGet(name string) Feature {
	switch strings.ToLower(name) {
	case "enable_sso":
		return FeatureSSO
	case "enable_compliance_logs":
		return FeatureComplianceLogs
	case "enable_node_federation":
		return FeatureNodeFederation
	case "enable_collaboration":
		return FeatureCollaboration
	case "enable_hosted_runner":
		return FeatureHostedRunner
	case "enable_advanced_spawn":
		return FeatureAdvancedSpawn
	default:
		panic("unknown feature: " + name)
	}
}
