package conformance_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"reach/services/runner/internal/autonomous"
	"reach/services/runner/internal/invariants"
	"reach/services/runner/internal/mesh"
	"reach/services/runner/internal/policy"
	"reach/services/runner/internal/registry"
	"reach/services/runner/internal/spec"
)

const (
	clauseGraphRules = "EXECUTION_SPEC §2.1 Execution graph rules"
	clauseReplay     = "EXECUTION_SPEC §2.4 Deterministic replay rules"
	clausePolicy     = "EXECUTION_SPEC §2.3 Policy gate contract"
	clauseFederation = "EXECUTION_SPEC §2.6 Federation delegation contract"
)

type passthroughExecutor struct{}

func (passthroughExecutor) Execute(_ context.Context, envelope autonomous.ExecutionEnvelope) (*autonomous.ExecutionResult, error) {
	return &autonomous.ExecutionResult{EnvelopeID: envelope.ID, Status: autonomous.StatusSuccess}, nil
}

func signedPack(t *testing.T) registry.ExecutionPack {
	t.Helper()
	pack := registry.ExecutionPack{
		Metadata:            registry.PackMetadata{ID: "pack.conf", Version: "1.0.0", SpecVersion: spec.Version},
		DeclaredTools:       []string{"tool.safe"},
		DeclaredPermissions: []string{"net:read"},
	}
	h, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = h
	return pack
}

func TestConformanceExecutionGraphRules(t *testing.T) {
	t.Run(clauseGraphRules, func(t *testing.T) {
		g := registry.ExecutionGraph{
			StartNodeID: "start",
			Nodes: map[string]registry.Node{
				"start": {ID: "start", Type: registry.NodeTypeAction, Name: "Start"},
				"next":  {ID: "next", Type: registry.NodeTypeAction, Name: "Next"},
			},
			Edges: []registry.Edge{{From: "start", To: "next", Type: registry.EdgeTypeDefault}},
		}

		if _, ok := g.Nodes[g.StartNodeID]; !ok {
			t.Fatalf("%s: start node must exist", clauseGraphRules)
		}
		for _, edge := range g.Edges {
			if _, ok := g.Nodes[edge.From]; !ok {
				t.Fatalf("%s: edge from node %q missing", clauseGraphRules, edge.From)
			}
			if _, ok := g.Nodes[edge.To]; !ok {
				t.Fatalf("%s: edge to node %q missing", clauseGraphRules, edge.To)
			}
		}
	})
}

func TestConformanceDeterministicReplayAndSpecVersion(t *testing.T) {
	t.Run(clauseReplay, func(t *testing.T) {
		pack := signedPack(t)
		exec := autonomous.NewPackExecutor(passthroughExecutor{}, pack, autonomous.WithSnapshotHash("snapshot-runtime"))

		res, err := exec.Execute(context.Background(), autonomous.ExecutionEnvelope{
			ID:          "env-1",
			ToolName:    "tool.safe",
			Arguments:   json.RawMessage(`{}`),
			Permissions: []string{"net:read"},
			Context: autonomous.ExecutionContext{
				IsReplay:             true,
				PackHash:             pack.SignatureHash,
				RegistrySnapshotHash: "snapshot-mismatch",
				SpecVersion:          spec.Version,
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		if res.Status != autonomous.StatusError {
			t.Fatalf("%s: expected replay mismatch to return status=error", clauseReplay)
		}

		if err := invariants.ReplaySnapshotMatches("snapshot-a", "snapshot-b"); err == nil {
			t.Fatalf("%s: replay snapshot mismatch must fail invariant", clauseReplay)
		}
	})
}

func TestConformancePolicyEnforcementAgainstDeclaredTools(t *testing.T) {
	t.Run(clausePolicy, func(t *testing.T) {
		decision := policy.Evaluate(policy.Input{
			Policy: policy.OrgPolicy{AllowedPermissions: []string{"net:read"}, AllowedModels: map[string][]string{}, RequireDeterministic: true},
			Pack: policy.ExecutionPack{
				ID:                  "pack.conf",
				Version:             "1.0.0",
				DeclaredTools:       []string{"tool.safe"},
				DeclaredPermissions: []string{"net:read"},
				Deterministic:       true,
				Signed:              true,
			},
			RequestedTools:       []string{"tool.blocked"},
			RequestedPermissions: []string{"net:read"},
			Mode:                 policy.ModeEnforce,
		})

		if !invariants.PolicyGateRejectsUndeclaredTool(decision) {
			t.Fatalf("%s: undeclared tool must be rejected", clausePolicy)
		}
	})
}

func TestConformanceFederationDelegationInvariants(t *testing.T) {
	t.Run(clauseFederation, func(t *testing.T) {
		pack := signedPack(t)
		reg := registry.NewInMemoryRegistry().WithSupportedPackMajor(1)
		if err := reg.Register(registry.Capability{ID: "cap.safe", RequiredTools: []string{"tool.safe"}}); err != nil {
			t.Fatal(err)
		}

		delegator := mesh.NewFederatedDelegator("node.local", reg).WithRegistrySnapshotHash("snapshot-1")
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()

		req := mesh.DelegationRequest{
			Pack:            pack,
			OriginNodeID:    "node.remote",
			DelegationDepth: 0,
			PolicyVersion:   "2026-01",
			RegistryHash:    "snapshot-1",
			SpecVersion:     spec.Version,
		}
		res, err := delegator.AcceptDelegation(ctx, req)
		if err != nil {
			t.Fatalf("%s: expected delegation acceptance, got %v", clauseFederation, err)
		}
		if res.Status != "accepted" {
			t.Fatalf("%s: expected accepted status, got %s", clauseFederation, res.Status)
		}

		req.SpecVersion = "2.0.0"
		if _, err := delegator.AcceptDelegation(ctx, req); err == nil {
			t.Fatalf("%s: incompatible spec version must be rejected", clauseFederation)
		}
	})
}
