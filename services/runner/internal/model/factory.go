package model

import (
	"context"
	"fmt"
	"os"
	"runtime"
)

// Factory creates and configures model adapters.
type Factory struct {
	config FactoryConfig
}

// FactoryConfig contains environment-aware settings.
type FactoryConfig struct {
	// Hosting mode
	Mode string `json:"mode"` // "auto", "hosted", "local", "edge"
	
	// Hosted model settings
	HostedEndpoint string `json:"hostedEndpoint,omitempty"`
	HostedAPIKey   string `json:"hostedApiKey,omitempty"`
	HostedModelID  string `json:"hostedModelId,omitempty"`
	
	// Local model settings
	LocalEndpoint string `json:"localEndpoint,omitempty"`
	LocalModelID  string `json:"localModelId,omitempty"`
	
	// Edge mode settings
	ForceEdgeMode bool `json:"forceEdgeMode"`
	
	// Platform detection
	Platform PlatformInfo `json:"platform"`
}

// PlatformInfo describes the runtime environment.
type PlatformInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	TotalRAM     uint64 `json:"totalRam"`
	AvailableRAM uint64 `json:"availableRam"`
	CPUCount     int    `json:"cpuCount"`
	IsAndroid    bool   `json:"isAndroid"`
	IsTermux     bool   `json:"isTermux"`
}

// NewFactory creates a model adapter factory.
func NewFactory(config FactoryConfig) *Factory {
	return &Factory{config: config}
}

// DetectPlatform gathers runtime environment info.
func DetectPlatform() PlatformInfo {
	info := PlatformInfo{
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		CPUCount:     runtime.NumCPU(),
	}
	
	// Detect Android/Termux
	if _, err := os.Stat("/data/data/com.termux/files/usr/bin"); err == nil {
		info.IsAndroid = true
		info.IsTermux = true
	}
	
	// Check for Android-specific paths
	if _, err := os.Stat("/system/build.prop"); err == nil {
		info.IsAndroid = true
	}
	
	// Detect RAM (simplified)
	info.TotalRAM = estimateTotalRAM()
	info.AvailableRAM = estimateAvailableRAM()
	
	return info
}

// CreateRegistry initializes all adapters based on configuration.
func (f *Factory) CreateRegistry(ctx context.Context) (*AdapterRegistry, error) {
	registry := NewAdapterRegistry()
	
	// Always register small mode as ultimate fallback
	smallMode := NewSmallModeAdapter(SmallModeConfig{EnableTemplating: true})
	if err := registry.Register(smallMode); err != nil {
		return nil, fmt.Errorf("register small mode: %w", err)
	}
	
	// Determine which adapters to register based on mode
	switch f.config.Mode {
	case "edge", "small":
		// Only small mode
		registry.SetDefault("small-mode")
		
	case "local":
		// Register local adapter if configured
		if f.config.LocalEndpoint != "" {
			local := f.createLocalAdapter()
			if err := registry.Register(local); err != nil {
				return nil, err
			}
			if local.Available(ctx) {
				registry.SetDefault(local.Name())
			} else {
				registry.SetDefault("small-mode")
			}
		} else {
			// Auto-detect local configs
			configs := DetectLocalCapabilities()
			for _, cfg := range configs {
				adapter := NewLocalAdapter(cfg)
				if err := registry.Register(adapter); err != nil {
					continue // Skip duplicates
				}
			}
			registry.SetDefault("small-mode")
		}
		
	case "hosted":
		// Register hosted adapter
		if f.config.HostedEndpoint != "" {
			hosted := f.createHostedAdapter()
			if err := registry.Register(hosted); err != nil {
				return nil, err
			}
			if hosted.Available(ctx) {
				registry.SetDefault(hosted.Name())
			} else {
				registry.SetDefault("small-mode")
			}
		}
		
	case "auto", "":
		// Try all: hosted -> local -> small
		
		// Register hosted if configured
		if f.config.HostedEndpoint != "" {
			hosted := f.createHostedAdapter()
			if err := registry.Register(hosted); err == nil && hosted.Available(ctx) {
				registry.SetDefault(hosted.Name())
			}
		}
		
		// Register local adapters
		configs := DetectLocalCapabilities()
		for _, cfg := range configs {
			adapter := NewLocalAdapter(cfg)
			if err := registry.Register(adapter); err != nil {
				continue
			}
			// Set as default if no default yet and available
			if registry.defaultAdapter == "" && adapter.Available(ctx) {
				registry.SetDefault(adapter.Name())
			}
		}
		
		// Fall back to small mode
		if registry.defaultAdapter == "" {
			registry.SetDefault("small-mode")
		}
	}
	
	return registry, nil
}

// CreateRouter creates a configured router for the registry.
func (f *Factory) CreateRouter(registry *AdapterRegistry) *Router {
	config := RouterConfig{
		PreferLocal:     f.config.Mode == "local",
		FallbackEnabled: true,
		EdgeMode:        f.config.Mode == "edge" || f.shouldAutoEdge(),
	}
	
	return NewRouter(registry, config)
}

func (f *Factory) createHostedAdapter() *HostedAdapter {
	return NewHostedAdapter(HostedConfig{
		Name:       "hosted",
		Endpoint:   f.config.HostedEndpoint,
		APIKey:     f.config.HostedAPIKey,
		ModelID:    f.config.HostedModelID,
		TimeoutSec: 60,
		Capabilities: ModelCapabilities{
			MaxContext:      200000,
			ToolCalling:     true,
			Streaming:       true,
			ReasoningDepth:  ReasoningHigh,
			MaxTokens:       8192,
			SupportsJSON:    true,
			EstimatedVRAMMB: 0, // Hosted - no local VRAM
		},
	})
}

func (f *Factory) createLocalAdapter() *LocalAdapter {
	return NewLocalAdapter(LocalConfig{
		Name:       "local",
		Endpoint:   f.config.LocalEndpoint,
		ModelID:    f.config.LocalModelID,
		TimeoutSec: 120,
		Capabilities: ModelCapabilities{
			MaxContext:      32768,
			ToolCalling:     false,
			Streaming:       true,
			ReasoningDepth:  ReasoningMedium,
			MaxTokens:       4096,
			SupportsJSON:    false,
			Quantization:    "Q4_K_M",
			EstimatedVRAMMB: 4000,
		},
	})
}

func (f *Factory) shouldAutoEdge() bool {
	// Auto-enable edge mode based on platform constraints
	if f.config.ForceEdgeMode {
		return true
	}
	
	if f.config.Platform.IsAndroid {
		return true
	}
	
	if f.config.Platform.TotalRAM < 4000 { // Less than 4GB RAM
		return true
	}
	
	if f.config.Platform.CPUCount < 2 {
		return true
	}
	
	return false
}

func estimateTotalRAM() uint64 {
	// Conservative default
	return 8000
}

func estimateAvailableRAM() uint64 {
	// Very conservative default
	return 2000
}

// Manager coordinates model access for the runtime.
type Manager struct {
	registry *AdapterRegistry
	router   *Router
	config   FactoryConfig
}

// NewManager creates a model manager.
func NewManager(registry *AdapterRegistry, router *Router, config FactoryConfig) *Manager {
	return &Manager{
		registry: registry,
		router:   router,
		config:   config,
	}
}

// Generate routes to the best available model and generates output.
func (m *Manager) Generate(ctx context.Context, input RouteInput, genInput GenerateInput, opts GenerateOptions) (*ModelOutput, error) {
	adapter, err := m.router.Route(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("route: %w", err)
	}
	
	return adapter.Generate(ctx, genInput, opts)
}

// Health returns health status for all adapters.
func (m *Manager) Health(ctx context.Context) map[string]HealthStatus {
	health := make(map[string]HealthStatus)
	
	for _, name := range m.registry.List() {
		adapter, _ := m.registry.Get(name)
		if adapter != nil {
			health[name] = adapter.Health(ctx)
		}
	}
	
	return health
}

// DefaultAdapter returns the current default adapter name.
func (m *Manager) DefaultAdapter() string {
	return m.registry.defaultAdapter
}
