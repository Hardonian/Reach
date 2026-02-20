package packloader

import (
	"context"
	"encoding/json"
	"testing"
)

func TestRuntimeInjector_InjectPack(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	pack := testLoadedPack("pack-a", []string{"read_file", "write_file"}, []string{"fs:read"}, nil)
	sandbox.RegisterPack(pack)

	err := injector.InjectPack(pack)
	if err != nil {
		t.Fatal(err)
	}

	caps := injector.ResolveCapability("read_file")
	if len(caps) != 1 {
		t.Fatalf("expected 1 capability for read_file, got %d", len(caps))
	}
	if caps[0].PackID != "pack-a" {
		t.Errorf("expected pack-a, got %s", caps[0].PackID)
	}
}

func TestRuntimeInjector_InjectPack_NilManifest(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	err := injector.InjectPack(&LoadedPack{})
	if err == nil {
		t.Error("expected error for nil manifest")
	}
}

func TestRuntimeInjector_InjectPack_Disabled(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	pack.Disabled = true
	pack.Error = "validation failed"

	err := injector.InjectPack(pack)
	if err == nil {
		t.Error("expected error for disabled pack")
	}
}

func TestRuntimeInjector_EjectPack(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)
	injector.InjectPack(pack)

	injector.EjectPack("pack-a")

	caps := injector.ResolveCapability("read_file")
	if len(caps) != 0 {
		t.Errorf("expected 0 capabilities after eject, got %d", len(caps))
	}
}

func TestRuntimeInjector_MultiplePacksSameTool(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	packA := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	packB := testLoadedPack("pack-b", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(packA)
	sandbox.RegisterPack(packB)
	injector.InjectPack(packA)
	injector.InjectPack(packB)

	caps := injector.ResolveCapability("read_file")
	if len(caps) != 2 {
		t.Fatalf("expected 2 capabilities for read_file, got %d", len(caps))
	}
}

func TestRuntimeInjector_ListCapabilities(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	pack := testLoadedPack("pack-a", []string{"read_file", "write_file"}, nil, nil)
	sandbox.RegisterPack(pack)
	injector.InjectPack(pack)

	caps := injector.ListCapabilities()
	if len(caps) != 2 {
		t.Fatalf("expected 2 tool entries, got %d", len(caps))
	}
}

func TestRuntimeInjector_Hooks(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	var hookCalled bool
	injector.RegisterHook("pack-a", HookBeforeExecute, func(ctx context.Context, event HookEvent) error {
		hookCalled = true
		if event.PackID != "pack-a" {
			t.Errorf("expected pack-a in event, got %s", event.PackID)
		}
		if event.Type != HookBeforeExecute {
			t.Errorf("expected before_execute type, got %s", event.Type)
		}
		return nil
	})

	ctx := context.Background()
	errs := injector.FireHooks(ctx, HookBeforeExecute, nil)
	if len(errs) != 0 {
		t.Errorf("expected no errors, got %v", errs)
	}
	if !hookCalled {
		t.Error("hook should have been called")
	}
}

func TestRuntimeInjector_Hooks_WithPayload(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	var receivedPayload json.RawMessage
	injector.RegisterHook("pack-a", HookAfterExecute, func(ctx context.Context, event HookEvent) error {
		receivedPayload = event.Payload
		return nil
	})

	payload := json.RawMessage(`{"result":"ok"}`)
	injector.FireHooks(context.Background(), HookAfterExecute, payload)

	if string(receivedPayload) != `{"result":"ok"}` {
		t.Errorf("unexpected payload: %s", receivedPayload)
	}
}

func TestRuntimeInjector_Hooks_ErrorCollection(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	injector.RegisterHook("pack-a", HookOnError, func(ctx context.Context, event HookEvent) error {
		return nil // success
	})
	injector.RegisterHook("pack-b", HookOnError, func(ctx context.Context, event HookEvent) error {
		return context.Canceled // failure
	})

	errs := injector.FireHooks(context.Background(), HookOnError, nil)
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
}

func TestRuntimeInjector_EjectRemovesHooks(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	var hookCalled bool
	injector.RegisterHook("pack-a", HookBeforeExecute, func(ctx context.Context, event HookEvent) error {
		hookCalled = true
		return nil
	})

	injector.EjectPack("pack-a")

	injector.FireHooks(context.Background(), HookBeforeExecute, nil)
	if hookCalled {
		t.Error("hook should not be called after eject")
	}
}

func TestRuntimeInjector_ExecuteWithPack(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	pack := testLoadedPack("pack-a", []string{"read_file"}, nil, nil)
	sandbox.RegisterPack(pack)
	injector.InjectPack(pack)

	ctx := context.Background()

	// Allowed
	result, err := injector.ExecuteWithPack(ctx, "pack-a", "read_file", func(ctx context.Context) (any, error) {
		return "data", nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if result != "data" {
		t.Errorf("unexpected result: %v", result)
	}

	// Denied
	_, err = injector.ExecuteWithPack(ctx, "pack-a", "exec_command", func(ctx context.Context) (any, error) {
		return nil, nil
	})
	if err == nil {
		t.Error("expected error for undeclared tool")
	}
}

func TestRuntimeInjector_ResolveCapability_Empty(t *testing.T) {
	sandbox := NewPackSandbox()
	injector := NewRuntimeInjector(sandbox)

	caps := injector.ResolveCapability("nonexistent")
	if caps != nil {
		t.Errorf("expected nil for nonexistent tool, got %v", caps)
	}
}
