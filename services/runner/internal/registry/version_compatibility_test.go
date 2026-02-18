package registry

import (
	"testing"

	"reach/services/runner/internal/spec"
)

func compatiblePack(t *testing.T, version string) ExecutionPack {
	t.Helper()
	pack := ExecutionPack{
		Metadata:      PackMetadata{ID: "pack.v", Version: version, SpecVersion: spec.Version},
		DeclaredTools: []string{"tool.echo"},
	}
	h, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = h
	return pack
}

func TestOlderPackVersionRunsOnNewerNode(t *testing.T) {
	reg := NewInMemoryRegistry().WithSupportedPackMajor(2)
	if err := reg.Register(Capability{ID: "cap.echo", RequiredTools: []string{"tool.echo"}}); err != nil {
		t.Fatal(err)
	}
	if err := reg.ValidatePackCompatibility(compatiblePack(t, "1.4.0")); err != nil {
		t.Fatalf("expected old pack to run on newer node: %v", err)
	}
}

func TestNewPackRejectedByIncompatibleNode(t *testing.T) {
	reg := NewInMemoryRegistry().WithSupportedPackMajor(1)
	if err := reg.Register(Capability{ID: "cap.echo", RequiredTools: []string{"tool.echo"}}); err != nil {
		t.Fatal(err)
	}
	if err := reg.ValidatePackCompatibility(compatiblePack(t, "2.0.0")); err == nil {
		t.Fatal("expected new pack rejection for incompatible node")
	}
}

func TestReplayAcrossMinorUpgradeIsCompatible(t *testing.T) {
	reg := NewInMemoryRegistry().WithSupportedPackMajor(1)
	if err := reg.Register(Capability{ID: "cap.echo", RequiredTools: []string{"tool.echo"}}); err != nil {
		t.Fatal(err)
	}
	if err := reg.ValidatePackCompatibility(compatiblePack(t, "1.1.0")); err != nil {
		t.Fatalf("expected replay across minor upgrade to remain compatible: %v", err)
	}
}
