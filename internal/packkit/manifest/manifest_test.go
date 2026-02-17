package manifest

import "testing"

func TestParseManifest(t *testing.T) {
	_, err := ParseManifest([]byte(`{"id":"x","version":"1.0.0","required_capabilities":["filesystem:read"],"side_effect_types":["network"],"risk_level":"low"}`))
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
}
