package model

import (
	"context"
	"testing"
)

func TestAdapterRegistry(t *testing.T) {
	registry := NewAdapterRegistry()
	
	// Test registering adapters
	small := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	if err := registry.Register(small); err != nil {
		t.Fatalf("register small mode: %v", err)
	}
	
	// Test duplicate registration
	if err := registry.Register(small); err != nil {
		t.Logf("Duplicate registration error (expected): %v", err)
	}
	
	// Test listing
	list := registry.List()
	if len(list) != 1 {
		t.Errorf("expected 1 adapter, got %d", len(list))
	}
	
	// Test getting adapter
	got, err := registry.Get("small-mode")
	if err != nil {
		t.Fatalf("get adapter: %v", err)
	}
	if got.Name() != "small-mode" {
		t.Errorf("expected small-mode, got %s", got.Name())
	}
	
	// Test default
	if err := registry.SetDefault("small-mode"); err != nil {
		t.Fatalf("set default: %v", err)
	}
	
	defaultAdapter, err := registry.Get("")
	if err != nil {
		t.Fatalf("get default: %v", err)
	}
	if defaultAdapter.Name() != "small-mode" {
		t.Errorf("expected small-mode default, got %s", defaultAdapter.Name())
	}
}

func TestSmallModeAdapter(t *testing.T) {
	adapter := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	
	// Test capabilities
	caps := adapter.Capabilities()
	if caps.MaxContext == 0 {
		t.Error("expected non-zero max context")
	}
	if caps.ToolCalling {
		t.Error("small mode should not support tool calling")
	}
	
	// Test availability
	ctx := context.Background()
	if !adapter.Available(ctx) {
		t.Error("small mode should always be available")
	}
	
	// Test generation
	input := GenerateInput{
		Messages: []Message{
			{Role: "user", Content: "help"},
		},
	}
	opts := GenerateOptions{}
	
	output, err := adapter.Generate(ctx, input, opts)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	
	if output.Content == "" {
		t.Error("expected non-empty content")
	}
	if output.FinishReason == "" {
		t.Error("expected finish reason")
	}
	if output.Metadata == nil {
		t.Error("expected metadata")
	}
}

func TestRouter(t *testing.T) {
	registry := NewAdapterRegistry()
	
	// Register small mode
	small := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	registry.Register(small)
	registry.SetDefault("small-mode")
	
	router := NewRouter(registry, RouterConfig{
		EdgeMode:        false,
		FallbackEnabled: true,
	})
	
	ctx := context.Background()
	
	// Test routing with simple input
	input := RouteInput{
		Complexity:    ComplexitySimple,
		RequireTools:  false,
		Offline:       false,
		ContextTokens: 100,
	}
	
	adapter, err := router.Route(ctx, input)
	if err != nil {
		t.Fatalf("route: %v", err)
	}
	if adapter == nil {
		t.Fatal("expected adapter, got nil")
	}
}

func TestRouterEdgeMode(t *testing.T) {
	registry := NewAdapterRegistry()
	
	// Register multiple adapters
	small := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	registry.Register(small)
	registry.SetDefault("small-mode")
	
	router := NewRouter(registry, RouterConfig{
		EdgeMode:        true,
		FallbackEnabled: true,
	})
	
	ctx := context.Background()
	
	// Test edge mode routing
	input := RouteInput{
		Complexity:    ComplexitySimple,
		Offline:       true,
		ContextTokens: 100,
	}
	
	adapter, err := router.Route(ctx, input)
	if err != nil {
		t.Fatalf("route: %v", err)
	}
	if adapter == nil {
		t.Fatal("expected adapter in edge mode")
	}
}

func TestFactory(t *testing.T) {
	config := FactoryConfig{
		Mode:       "edge",
		Platform:   DetectPlatform(),
	}
	
	factory := NewFactory(config)
	
	ctx := context.Background()
	registry, err := factory.CreateRegistry(ctx)
	if err != nil {
		t.Fatalf("create registry: %v", err)
	}
	
	// Edge mode should only have small-mode
	adapters := registry.List()
	if len(adapters) != 1 {
		t.Errorf("edge mode: expected 1 adapter, got %d", len(adapters))
	}
	
	defaultAdapter, _ := registry.Get("")
	if defaultAdapter == nil {
		t.Error("expected default adapter")
	} else if defaultAdapter.Name() != "small-mode" {
		t.Errorf("expected small-mode, got %s", defaultAdapter.Name())
	}
}

func TestPlatformDetection(t *testing.T) {
	platform := DetectPlatform()
	
	if platform.OS == "" {
		t.Error("expected OS to be detected")
	}
	if platform.Architecture == "" {
		t.Error("expected architecture to be detected")
	}
	if platform.CPUCount == 0 {
		t.Error("expected CPU count to be detected")
	}
}

func TestManager(t *testing.T) {
	registry := NewAdapterRegistry()
	small := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	registry.Register(small)
	registry.SetDefault("small-mode")
	
	router := NewRouter(registry, RouterConfig{})
	manager := NewManager(registry, router, FactoryConfig{})
	
	// Test health
	ctx := context.Background()
	health := manager.Health(ctx)
	if len(health) != 1 {
		t.Errorf("expected 1 health entry, got %d", len(health))
	}
	
	// Test default adapter
	if manager.DefaultAdapter() != "small-mode" {
		t.Errorf("expected small-mode, got %s", manager.DefaultAdapter())
	}
}

func BenchmarkSmallModeGenerate(b *testing.B) {
	adapter := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	ctx := context.Background()
	input := GenerateInput{
		Messages: []Message{
			{Role: "user", Content: "help"},
		},
	}
	opts := GenerateOptions{}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := adapter.Generate(ctx, input, opts)
		if err != nil {
			b.Fatal(err)
		}
	}
}
