package packloader

import (
	"context"
	"testing"
)

func testLoadedPack(id string, tools []string, perms []string, exports []string) *LoadedPack {
	return &LoadedPack{
		Manifest: &PackManifest{
			SchemaVersion:       "1.0.0",
			Metadata:            PackMetadata{ID: id, Version: "1.0.0", Name: id},
			DeclaredTools:       tools,
			DeclaredPermissions: perms,
			Exports:             exports,
		},
		Hash: "testhash",
	}
}

func TestPackNamespace_Isolation(t *testing.T) {
	ns1 := NewPackNamespace("pack-a", "1.0.0")
	ns2 := NewPackNamespace("pack-b", "1.0.0")

	ns1.Set("key", "value-a")
	ns2.Set("key", "value-b")

	v1, _ := ns1.Get("key")
	v2, _ := ns2.Get("key")

	if v1 != "value-a" {
		t.Errorf("ns1 expected value-a, got %v", v1)
	}
	if v2 != "value-b" {
		t.Errorf("ns2 expected value-b, got %v", v2)
	}
}

func TestPackNamespace_Seal(t *testing.T) {
	ns := NewPackNamespace("pack-a", "1.0.0")
	ns.Set("existing", "value")
	ns.Seal()

	// Updating existing key should work
	if err := ns.Set("existing", "updated"); err != nil {
		t.Errorf("should allow updating existing key after seal: %v", err)
	}

	// Adding new key should fail
	if err := ns.Set("new-key", "value"); err == nil {
		t.Error("should reject new key after seal")
	}
}

func TestPackNamespace_Exports(t *testing.T) {
	ns := NewPackNamespace("pack-a", "1.0.0")
	ns.Export("capability", "some-value")

	val, ok := ns.GetExport("capability")
	if !ok {
		t.Error("expected export to exist")
	}
	if val != "some-value" {
		t.Errorf("unexpected export value: %v", val)
	}

	_, ok = ns.GetExport("nonexistent")
	if ok {
		t.Error("expected nonexistent export to not exist")
	}
}

func TestPackSandbox_ToolAccess(t *testing.T) {
	sandbox := NewPackSandbox()

	pack := testLoadedPack("pack-a", []string{"read_file", "write_file"}, []string{"fs:read"}, nil)
	sandbox.RegisterPack(pack)

	// Allowed tool
	if err := sandbox.CheckToolAccess("pack-a", "read_file"); err != nil {
		t.Errorf("expected tool access allowed: %v", err)
	}

	// Denied tool
	if err := sandbox.CheckToolAccess("pack-a", "exec_command"); err == nil {
		t.Error("expected tool access denied for undeclared tool")
	}

	// Unregistered pack
	if err := sandbox.CheckToolAccess("pack-unknown", "read_file"); err == nil {
		t.Error("expected error for unregistered pack")
	}
}

func TestPackSandbox_PermissionAccess(t *testing.T) {
	sandbox := NewPackSandbox()

	pack := testLoadedPack("pack-a", []string{"read_file"}, []string{"fs:read", "fs:write"}, nil)
	sandbox.RegisterPack(pack)

	if err := sandbox.CheckPermission("pack-a", "fs:read"); err != nil {
		t.Errorf("expected permission allowed: %v", err)
	}
	if err := sandbox.CheckPermission("pack-a", "sys:admin"); err == nil {
		t.Error("expected permission denied for undeclared permission")
	}
}

func TestPackSandbox_CrossPackIsolation(t *testing.T) {
	sandbox := NewPackSandbox()

	packA := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	packB := testLoadedPack("pack-b", []string{"exec_command"}, nil, nil)
	sandbox.RegisterPack(packA)
	sandbox.RegisterPack(packB)

	// pack-a can read but not exec
	if err := sandbox.CheckToolAccess("pack-a", "read_file"); err != nil {
		t.Error("pack-a should access read_file")
	}
	if err := sandbox.CheckToolAccess("pack-a", "exec_command"); err == nil {
		t.Error("pack-a should NOT access exec_command")
	}

	// pack-b can exec but not read
	if err := sandbox.CheckToolAccess("pack-b", "exec_command"); err != nil {
		t.Error("pack-b should access exec_command")
	}
	if err := sandbox.CheckToolAccess("pack-b", "read_file"); err == nil {
		t.Error("pack-b should NOT access read_file")
	}
}

func TestPackSandbox_ReadExport(t *testing.T) {
	sandbox := NewPackSandbox()

	provider := testLoadedPack("provider", []string{"read_file"}, nil, []string{"shared_data"})
	consumer := testLoadedPack("consumer", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(provider)
	sandbox.RegisterPack(consumer)

	// Set export on provider
	ns, _ := sandbox.GetNamespace("provider")
	ns.Export("shared_data", "hello")

	// Consumer reads export
	val, err := sandbox.ReadExport("consumer", "provider", "shared_data")
	if err != nil {
		t.Fatalf("expected successful export read: %v", err)
	}
	if val != "hello" {
		t.Errorf("unexpected export value: %v", val)
	}

	// Consumer cannot read unexported data
	_, err = sandbox.ReadExport("consumer", "provider", "private_data")
	if err == nil {
		t.Error("expected error reading unexported data")
	}
}

func TestPackSandbox_EnforcedCall(t *testing.T) {
	sandbox := NewPackSandbox()
	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)

	ctx := context.Background()

	// Allowed call
	result, err := sandbox.EnforcedCall(ctx, "pack-a", "read_file", func(ctx context.Context) (any, error) {
		return "file contents", nil
	})
	if err != nil {
		t.Fatalf("expected allowed call: %v", err)
	}
	if result != "file contents" {
		t.Errorf("unexpected result: %v", result)
	}

	// Denied call
	_, err = sandbox.EnforcedCall(ctx, "pack-a", "exec_command", func(ctx context.Context) (any, error) {
		return nil, nil
	})
	if err == nil {
		t.Error("expected denied call for undeclared tool")
	}
}

func TestPackSandbox_AuditLog(t *testing.T) {
	sandbox := NewPackSandbox()
	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)

	sandbox.CheckToolAccess("pack-a", "read_file")
	sandbox.CheckToolAccess("pack-a", "denied_tool")

	log := sandbox.AuditLog()
	if len(log) != 2 {
		t.Fatalf("expected 2 audit entries, got %d", len(log))
	}
	if !log[0].Allowed {
		t.Error("first entry should be allowed")
	}
	if log[1].Allowed {
		t.Error("second entry should be denied")
	}
}

func TestPackSandbox_AuditSink(t *testing.T) {
	sandbox := NewPackSandbox()
	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)

	var sinkCalled bool
	sandbox.SetAuditSink(func(entry AuditEntry) {
		sinkCalled = true
	})

	sandbox.CheckToolAccess("pack-a", "read_file")
	if !sinkCalled {
		t.Error("audit sink should have been called")
	}
}

func TestPackSandbox_UnregisterPack(t *testing.T) {
	sandbox := NewPackSandbox()
	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)

	sandbox.UnregisterPack("pack-a")

	if err := sandbox.CheckToolAccess("pack-a", "read_file"); err == nil {
		t.Error("expected error after unregister")
	}
}

func TestPackSandbox_GetNamespace_NotRegistered(t *testing.T) {
	sandbox := NewPackSandbox()
	_, err := sandbox.GetNamespace("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent namespace")
	}
}
