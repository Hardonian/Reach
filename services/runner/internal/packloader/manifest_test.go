package packloader

import (
	"encoding/json"
	"testing"
)

func validManifest() *PackManifest {
	return &PackManifest{
		SchemaVersion: "1.0.0",
		Metadata: PackMetadata{
			ID:      "com.example.testpack",
			Version: "1.0.0",
			Name:    "Test Pack",
		},
		DeclaredTools:       []string{"read_file", "write_file"},
		DeclaredPermissions: []string{"fs:read", "fs:write"},
		Deterministic:       true,
	}
}

func TestValidateManifest_Valid(t *testing.T) {
	m := validManifest()
	result := ValidateManifest(m)
	if !result.Valid {
		t.Errorf("expected valid manifest, got errors: %v", result.Errors)
	}
}

func TestValidateManifest_MissingSchemaVersion(t *testing.T) {
	m := validManifest()
	m.SchemaVersion = ""
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid manifest for missing schema_version")
	}
	assertFieldError(t, result, "schema_version")
}

func TestValidateManifest_InvalidSchemaVersion(t *testing.T) {
	m := validManifest()
	m.SchemaVersion = "notaversion"
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid manifest for bad schema_version")
	}
}

func TestValidateManifest_MissingMetadataID(t *testing.T) {
	m := validManifest()
	m.Metadata.ID = ""
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid manifest for missing metadata.id")
	}
	assertFieldError(t, result, "metadata.id")
}

func TestValidateManifest_InvalidPackID(t *testing.T) {
	tests := []string{
		"AB",              // uppercase
		"a",               // too short
		"0starts-number",  // starts with number
		"has spaces here", // spaces
	}
	for _, id := range tests {
		m := validManifest()
		m.Metadata.ID = id
		result := ValidateManifest(m)
		if result.Valid {
			t.Errorf("expected invalid for pack ID %q", id)
		}
	}
}

func TestValidateManifest_ValidPackIDs(t *testing.T) {
	tests := []string{
		"com.example.pack",
		"my-pack",
		"my_pack",
		"abc",
		"my.great.pack-v2",
	}
	for _, id := range tests {
		m := validManifest()
		m.Metadata.ID = id
		result := ValidateManifest(m)
		if !result.Valid {
			t.Errorf("expected valid for pack ID %q, got errors: %v", id, result.Errors)
		}
	}
}

func TestValidateManifest_MissingVersion(t *testing.T) {
	m := validManifest()
	m.Metadata.Version = ""
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for missing version")
	}
	assertFieldError(t, result, "metadata.version")
}

func TestValidateManifest_InvalidSemver(t *testing.T) {
	m := validManifest()
	m.Metadata.Version = "not.a.version.really"
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for bad semver")
	}
}

func TestValidateManifest_MissingName(t *testing.T) {
	m := validManifest()
	m.Metadata.Name = ""
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for missing name")
	}
	assertFieldError(t, result, "metadata.name")
}

func TestValidateManifest_DuplicateTools(t *testing.T) {
	m := validManifest()
	m.DeclaredTools = []string{"read_file", "read_file"}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for duplicate tools")
	}
}

func TestValidateManifest_InvalidToolName(t *testing.T) {
	m := validManifest()
	m.DeclaredTools = []string{"invalid tool name!"}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for bad tool name")
	}
}

func TestValidateManifest_DuplicatePermissions(t *testing.T) {
	m := validManifest()
	m.DeclaredPermissions = []string{"fs:read", "fs:read"}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for duplicate permissions")
	}
}

func TestValidateManifest_InvalidPermissionFormat(t *testing.T) {
	m := validManifest()
	m.DeclaredPermissions = []string{"badformat"}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for bad permission format")
	}
}

func TestValidateManifest_SystemPermissionWarning(t *testing.T) {
	m := validManifest()
	m.DeclaredPermissions = []string{"sys:exec"}
	result := ValidateManifest(m)
	if len(result.Warnings) == 0 {
		t.Error("expected warning for system permission")
	}
}

func TestValidateManifest_GraphWithCycle(t *testing.T) {
	m := validManifest()
	m.ExecutionGraph = &ExecutionGraph{
		Nodes: map[string]GraphNode{
			"a": {ID: "a", Type: "action", Name: "A"},
			"b": {ID: "b", Type: "action", Name: "B"},
		},
		Edges: []GraphEdge{
			{From: "a", To: "b", Type: "default"},
			{From: "b", To: "a", Type: "default"},
		},
		StartNodeID: "a",
	}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for cyclic graph")
	}
}

func TestValidateManifest_GraphWithMissingNode(t *testing.T) {
	m := validManifest()
	m.ExecutionGraph = &ExecutionGraph{
		Nodes: map[string]GraphNode{
			"a": {ID: "a", Type: "action", Name: "A"},
		},
		Edges: []GraphEdge{
			{From: "a", To: "nonexistent", Type: "default"},
		},
		StartNodeID: "a",
	}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for edge referencing missing node")
	}
}

func TestValidateManifest_GraphMissingStartNode(t *testing.T) {
	m := validManifest()
	m.ExecutionGraph = &ExecutionGraph{
		Nodes: map[string]GraphNode{
			"a": {ID: "a", Type: "action", Name: "A"},
		},
		StartNodeID: "",
	}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for missing start_node_id")
	}
}

func TestValidateManifest_ValidGraph(t *testing.T) {
	m := validManifest()
	m.ExecutionGraph = &ExecutionGraph{
		Nodes: map[string]GraphNode{
			"a": {ID: "a", Type: "action", Name: "A"},
			"b": {ID: "b", Type: "action", Name: "B"},
			"c": {ID: "c", Type: "action", Name: "C"},
		},
		Edges: []GraphEdge{
			{From: "a", To: "b", Type: "default"},
			{From: "b", To: "c", Type: "default"},
		},
		StartNodeID: "a",
	}
	result := ValidateManifest(m)
	if !result.Valid {
		t.Errorf("expected valid graph, got errors: %v", result.Errors)
	}
}

func TestValidateManifest_Dependencies(t *testing.T) {
	m := validManifest()
	m.Dependencies = []PackDependency{
		{ID: "dep.one", Version: "1.0.0"},
	}
	result := ValidateManifest(m)
	if !result.Valid {
		t.Errorf("expected valid with deps, got: %v", result.Errors)
	}
}

func TestValidateManifest_DuplicateDependency(t *testing.T) {
	m := validManifest()
	m.Dependencies = []PackDependency{
		{ID: "dep.one", Version: "1.0.0"},
		{ID: "dep.one", Version: "2.0.0"},
	}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for duplicate dependency")
	}
}

func TestValidateManifest_DependencyMissingVersion(t *testing.T) {
	m := validManifest()
	m.Dependencies = []PackDependency{
		{ID: "dep.one"},
	}
	result := ValidateManifest(m)
	if result.Valid {
		t.Error("expected invalid for dependency missing version")
	}
}

func TestComputeHash_Deterministic(t *testing.T) {
	m := validManifest()
	h1, err := ComputeHash(m)
	if err != nil {
		t.Fatal(err)
	}
	h2, err := ComputeHash(m)
	if err != nil {
		t.Fatal(err)
	}
	if h1 != h2 {
		t.Errorf("hashes not deterministic: %s != %s", h1, h2)
	}
}

func TestComputeHash_ExcludesSignature(t *testing.T) {
	m := validManifest()
	h1, _ := ComputeHash(m)

	m.SignatureHash = "should-be-excluded"
	h2, _ := ComputeHash(m)

	if h1 != h2 {
		t.Error("hash should not change when signature_hash is set")
	}
}

func TestVerifyIntegrity_Valid(t *testing.T) {
	m := validManifest()
	hash, _ := ComputeHash(m)
	m.SignatureHash = hash

	if err := VerifyIntegrity(m); err != nil {
		t.Errorf("expected valid integrity: %v", err)
	}
}

func TestVerifyIntegrity_Tampered(t *testing.T) {
	m := validManifest()
	m.SignatureHash = "tampered-hash-value"

	if err := VerifyIntegrity(m); err == nil {
		t.Error("expected integrity failure for tampered manifest")
	}
}

func TestVerifyIntegrity_Empty(t *testing.T) {
	m := validManifest()
	if err := VerifyIntegrity(m); err == nil {
		t.Error("expected error for empty signature hash")
	}
}

func TestParseManifest_ValidJSON(t *testing.T) {
	m := validManifest()
	data, _ := json.Marshal(m)

	parsed, result, err := ParseManifest(data)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Valid {
		t.Errorf("expected valid parse, got: %v", result.Errors)
	}
	if parsed.Metadata.ID != "com.example.testpack" {
		t.Errorf("unexpected ID: %s", parsed.Metadata.ID)
	}
}

func TestParseManifest_InvalidJSON(t *testing.T) {
	_, _, err := ParseManifest([]byte("{invalid"))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func assertFieldError(t *testing.T, r *ValidationResult, field string) {
	t.Helper()
	for _, e := range r.Errors {
		if e.Field == field {
			return
		}
	}
	t.Errorf("expected error for field %s, got errors: %v", field, r.Errors)
}
