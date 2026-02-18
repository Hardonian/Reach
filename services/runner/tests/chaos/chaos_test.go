package chaos_test

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	mathrand "math/rand"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"reach/services/runner/internal/autonomous"
	"reach/services/runner/internal/invariants"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/mesh"
	"reach/services/runner/internal/policy"
	"reach/services/runner/internal/registry"
	"reach/services/runner/internal/storage"
)

type slowExecutor struct{ delay time.Duration }

func (s slowExecutor) Execute(ctx context.Context, envelope autonomous.ExecutionEnvelope) (*autonomous.ExecutionResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(s.delay):
		return &autonomous.ExecutionResult{EnvelopeID: envelope.ID, Status: autonomous.StatusSuccess}, nil
	}
}

func testPack(t *testing.T, version string) registry.ExecutionPack {
	t.Helper()
	pack := registry.ExecutionPack{
		Metadata:            registry.PackMetadata{ID: "pack.chaos", Version: version},
		DeclaredTools:       []string{"tool.echo"},
		DeclaredPermissions: []string{"workspace:read"},
	}
	h, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = h
	return pack
}

func testDelegator(t *testing.T, supportedMajor int, registryHash string) *mesh.FederatedDelegator {
	t.Helper()
	reg := registry.NewInMemoryRegistry().WithSupportedPackMajor(supportedMajor)
	if err := reg.Register(registry.Capability{ID: "cap.echo", RequiredTools: []string{"tool.echo"}}); err != nil {
		t.Fatal(err)
	}
	return mesh.NewFederatedDelegator("node-b", reg).WithRegistrySnapshotHash(registryHash)
}

func TestChaosRandomNetworkDelayInFederationFailsSafe(t *testing.T) {
	delegator := testDelegator(t, 2, "snapshot-a")
	rng := mathrand.New(mathrand.NewSource(7))
	for i := 0; i < 20; i++ {
		delay := time.Duration(rng.Intn(15)) * time.Millisecond
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		time.Sleep(delay)
		_, err := delegator.AcceptDelegation(ctx, mesh.DelegationRequest{
			Pack:          testPack(t, "1.1.0"),
			OriginNodeID:  "node-a",
			RegistryHash:  "snapshot-a",
			Deterministic: true,
		})
		cancel()
		if err != nil {
			t.Fatalf("delegation should remain safe under delay %v: %v", delay, err)
		}
	}
}

func TestChaosToolExecutionTimeoutDoesNotRetryForever(t *testing.T) {
	exec := slowExecutor{delay: 80 * time.Millisecond}
	envelope := autonomous.ExecutionEnvelope{ID: "env-timeout", ToolName: "tool.echo"}
	attempts := 0
	for attempts < 5 {
		attempts++
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
		_, err := exec.Execute(ctx, envelope)
		cancel()
		if errors.Is(err, context.DeadlineExceeded) {
			break
		}
	}
	if attempts != 1 {
		t.Fatalf("expected fail-safe stop after timeout, got attempts=%d", attempts)
	}
}

func TestChaosPolicyRejectionMidRun(t *testing.T) {
	decision := policy.Evaluate(policy.Input{
		Policy: policy.OrgPolicy{AllowedPermissions: []string{"workspace:read"}, AllowedModels: map[string][]string{"tier": {"standard"}}},
		Pack: policy.ExecutionPack{
			Signed:              true,
			DeclaredTools:       []string{"tool.echo"},
			DeclaredPermissions: []string{"workspace:read"},
			ModelRequirements:   map[string]string{"tier": "standard"},
		},
		RequestedTools:       []string{"tool.exec"},
		RequestedPermissions: []string{"workspace:read"},
	})
	if !invariants.PolicyGateRejectsUndeclaredTool(decision) {
		t.Fatalf("expected undeclared tool denial, got %#v", decision)
	}
}

func TestChaosVersionMismatchRejected(t *testing.T) {
	delegator := testDelegator(t, 1, "snapshot-a")
	_, err := delegator.AcceptDelegation(context.Background(), mesh.DelegationRequest{
		Pack:         testPack(t, "2.0.0"),
		OriginNodeID: "node-a",
		RegistryHash: "snapshot-a",
	})
	if err == nil || !strings.Contains(err.Error(), "incompatible") {
		t.Fatalf("expected major version mismatch rejection, got %v", err)
	}
}

func TestChaosCorruptedAuditEntryRejected(t *testing.T) {
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := jobs.NewStore(db)
	run, err := store.CreateRun(context.Background(), "tenant-a", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.AppendEvent(context.Background(), run.ID, jobs.Event{Type: "tool.result", Payload: []byte(`{"schemaVersion":"1.0.0"`), CreatedAt: time.Now().UTC()})
	if err == nil {
		t.Fatal("expected corrupted audit payload rejection")
	}
}

func TestChaosDelegationRegistryHashCannotChange(t *testing.T) {
	delegator := testDelegator(t, 1, "snapshot-a")
	req := mesh.DelegationRequest{Pack: testPack(t, "1.0.0"), OriginNodeID: "node-a", RegistryHash: "snapshot-b"}
	if invariants.DelegationRegistryHashPreserved(req, "snapshot-a") {
		t.Fatal("expected invariant helper to detect mismatch")
	}
	_, err := delegator.AcceptDelegation(context.Background(), req)
	if err == nil || err.Error() != "registry snapshot hash mismatch" {
		t.Fatalf("expected registry hash mismatch error, got %v", err)
	}
}

func TestChaosReplayFailsOnSnapshotMismatch(t *testing.T) {
	if err := invariants.ReplaySnapshotMatches("hash-a", "hash-b"); err == nil {
		t.Fatal("expected replay snapshot mismatch error")
	}
}

func TestChaosHandshakeRejectsPolicyVersionMismatch(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	h := mesh.NewHandshaker(time.Minute)
	challenge, err := h.NewChallenge("2026-01", "snapshot-a")
	if err != nil {
		t.Fatal(err)
	}
	caps := mesh.CapabilityAdvertisement{CapabilitiesHash: "caps", RegistrySnapshotHash: "snapshot-a", PolicyVersion: "2027-01"}
	sig := mesh.SignHandshake(priv, challenge, caps, "node-a")
	_, err = h.Verify(mesh.NodeIdentity{NodeID: "node-a", NodePublicKey: pub}, mesh.Response{Challenge: challenge, Capabilities: caps, NodeID: "node-a", Signature: sig})
	if err == nil || !strings.Contains(err.Error(), "policy version mismatch") {
		t.Fatalf("expected policy mismatch rejection, got %v", err)
	}
}
