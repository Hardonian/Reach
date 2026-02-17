package policy

import "testing"

func baseInput() Input {
	return Input{
		Policy: OrgPolicy{
			Version:             "2026-01",
			AllowedPermissions:  []string{"workspace:read", "workspace:write"},
			AllowedModels:       map[string][]string{"tier": []string{"standard"}},
			AllowLegacyUnsigned: false,
		},
		Node: NodeIdentity{NodeID: "node-a", OrgID: "org-a"},
		Pack: ExecutionPack{
			ID:                  "pack.a",
			Version:             "1.0.0",
			Hash:                "abcdef0123456789",
			DeclaredTools:       []string{"tool.write_file"},
			DeclaredPermissions: []string{"workspace:write"},
			ModelRequirements:   map[string]string{"tier": "standard"},
			Deterministic:       true,
			Signed:              true,
		},
		RequestedTools:       []string{"tool.write_file"},
		RequestedPermissions: []string{"workspace:write"},
	}
}

func TestEvaluateAllow(t *testing.T) {
	decision := Evaluate(baseInput())
	if !decision.Allowed {
		t.Fatalf("expected allow got reasons=%v", decision.Reasons)
	}
}

func TestEvaluateDenyUndeclaredTool(t *testing.T) {
	in := baseInput()
	in.RequestedTools = []string{"tool.echo"}
	decision := Evaluate(in)
	if decision.Allowed || decision.Reasons[0] != ReasonUndeclaredTool {
		t.Fatalf("expected undeclared tool denial: %#v", decision)
	}
}

func TestEvaluateDenyPermissionEscalation(t *testing.T) {
	in := baseInput()
	in.RequestedPermissions = []string{"workspace:admin"}
	decision := Evaluate(in)
	if decision.Allowed || decision.Reasons[0] != ReasonPermissionEscalation {
		t.Fatalf("expected permission denial: %#v", decision)
	}
}

func TestEvaluateLegacyUnsigned(t *testing.T) {
	in := baseInput()
	in.Pack.Signed = false
	in.Pack.LegacyUnsigned = true
	decision := Evaluate(in)
	if decision.Allowed {
		t.Fatal("expected deny without explicit policy allow")
	}
	in.Policy.AllowLegacyUnsigned = true
	decision = Evaluate(in)
	if !decision.Allowed {
		t.Fatalf("expected allow with legacy unsigned enabled: %#v", decision)
	}
}
