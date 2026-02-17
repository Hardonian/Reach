package storage

import (
	"testing"
	"time"
)

func TestCheckAndMarkReplayScopesByTenantProviderNonce(t *testing.T) {
	t.Parallel()

	s, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer s.Close()

	if err := s.CheckAndMarkReplay("tenant-a", "github", "nonce-1", 10*time.Minute); err != nil {
		t.Fatalf("first insert should pass: %v", err)
	}
	if err := s.CheckAndMarkReplay("tenant-a", "github", "nonce-1", 10*time.Minute); err == nil {
		t.Fatal("expected duplicate replay rejection for same tenant/provider/nonce")
	}

	if err := s.CheckAndMarkReplay("tenant-a", "slack", "nonce-1", 10*time.Minute); err != nil {
		t.Fatalf("provider namespace should isolate replay keys: %v", err)
	}
	if err := s.CheckAndMarkReplay("tenant-b", "github", "nonce-1", 10*time.Minute); err != nil {
		t.Fatalf("tenant namespace should isolate replay keys: %v", err)
	}
	if err := s.CheckAndMarkReplay("tenant-a", "github", "nonce-2", 10*time.Minute); err != nil {
		t.Fatalf("nonce namespace should isolate replay keys: %v", err)
	}
}
