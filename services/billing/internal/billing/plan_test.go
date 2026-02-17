package billing

import "testing"

func TestFeatureSetByTier(t *testing.T) {
	free := FeatureSet(Free, 0)
	if !free.LocalOnly || free.MaxSpawnDepth != 1 || free.HostedRunner {
		t.Fatalf("unexpected free features: %+v", free)
	}
	pro := FeatureSet(Pro, 0)
	if !pro.HostedRunner || !pro.Collaboration || pro.MaxSpawnDepth != 2 {
		t.Fatalf("unexpected pro features: %+v", pro)
	}
	ent := FeatureSet(Enterprise, 10)
	if !ent.SSO || !ent.ComplianceLogs || !ent.NodeFederation || ent.MaxSpawnDepth != 10 {
		t.Fatalf("unexpected enterprise features: %+v", ent)
	}
}
