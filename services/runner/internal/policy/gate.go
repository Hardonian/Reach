package policy

import (
	"os"
	"slices"
	"strings"
)

type Mode string

const (
	ModeWarn    Mode = "warn"
	ModeEnforce Mode = "enforce"
)

type DenyReason string

const (
	ReasonInvalidSignature     DenyReason = "invalid_signature"
	ReasonUndeclaredTool       DenyReason = "undeclared_tool"
	ReasonPermissionEscalation DenyReason = "permission_scope_exceeds_policy"
	ReasonModelNotAllowed      DenyReason = "model_requirement_not_allowed"
	ReasonDeterminismRequired  DenyReason = "determinism_required"
)

func (r DenyReason) String() string { return string(r) }

type OrgPolicy struct {
	Version              string
	AllowedPermissions   []string
	AllowedModels        map[string][]string
	AllowLegacyUnsigned  bool
	RequireDeterministic bool
}

type NodeIdentity struct {
	NodeID string
	OrgID  string
}

type ExecutionPack struct {
	ID                  string
	Version             string
	Hash                string
	DeclaredTools       []string
	DeclaredPermissions []string
	ModelRequirements   map[string]string
	Deterministic       bool
	Signed              bool
	LegacyUnsigned      bool
}

type Input struct {
	Policy               OrgPolicy
	Node                 NodeIdentity
	Pack                 ExecutionPack
	RequestedTools       []string
	RequestedPermissions []string
	Mode                 Mode
}

type Decision struct {
	Allowed    bool
	Reasons    []DenyReason
	Redactions map[string]string
}

func Evaluate(in Input) Decision {
	reasons := make([]DenyReason, 0)
	if !in.Pack.Signed && !(in.Pack.LegacyUnsigned && in.Policy.AllowLegacyUnsigned) {
		reasons = append(reasons, ReasonInvalidSignature)
	}

	for _, tool := range in.RequestedTools {
		if !slices.Contains(in.Pack.DeclaredTools, tool) {
			reasons = append(reasons, ReasonUndeclaredTool)
			break
		}
	}

	for _, perm := range in.RequestedPermissions {
		if !slices.Contains(in.Pack.DeclaredPermissions, perm) || !slices.Contains(in.Policy.AllowedPermissions, perm) {
			reasons = append(reasons, ReasonPermissionEscalation)
			break
		}
	}

	for key, value := range in.Pack.ModelRequirements {
		allowed := in.Policy.AllowedModels[key]
		if len(allowed) > 0 && !slices.Contains(allowed, value) {
			reasons = append(reasons, ReasonModelNotAllowed)
			break
		}
	}

	if in.Policy.RequireDeterministic && !in.Pack.Deterministic {
		reasons = append(reasons, ReasonDeterminismRequired)
	}

	return Decision{
		Allowed: len(reasons) == 0,
		Reasons: reasons,
		Redactions: map[string]string{
			"pack_hash": redact(in.Pack.Hash),
			"node_id":   redact(in.Node.NodeID),
		},
	}
}

func AllowLegacyUnsignedFromEnv() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("REACH_ALLOW_LEGACY_UNSIGNED_PACKS")), "true")
}

func ModeFromEnv() Mode {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("REACH_POLICY_MODE")))
	if raw == string(ModeEnforce) {
		return ModeEnforce
	}
	if raw == string(ModeWarn) {
		return ModeWarn
	}
	if os.Getenv("CI") != "" || strings.EqualFold(os.Getenv("GO_ENV"), "production") {
		return ModeEnforce
	}
	return ModeWarn
}

func redact(value string) string {
	if len(value) <= 8 {
		return "redacted"
	}
	return value[:4] + "..." + value[len(value)-4:]
}
