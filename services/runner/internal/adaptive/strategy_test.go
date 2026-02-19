package adaptive

import (
	"testing"

	"reach/services/runner/internal/config"
	"reach/services/runner/internal/model"
)

func TestDefaultEngineConfig(t *testing.T) {
	cfg := DefaultEngineConfig()

	if cfg.LowMemoryMB != 512 {
		t.Errorf("expected LowMemoryMB=512, got %d", cfg.LowMemoryMB)
	}
	if cfg.LowBandwidthKbps != 100 {
		t.Errorf("expected LowBandwidthKbps=100, got %d", cfg.LowBandwidthKbps)
	}
	if cfg.HighLatencyMs != 1000 {
		t.Errorf("expected HighLatencyMs=1000, got %d", cfg.HighLatencyMs)
	}
	if cfg.MinModelCapability != model.ReasoningLow {
		t.Errorf("expected MinModelCapability=ReasoningLow, got %v", cfg.MinModelCapability)
	}
	if !cfg.AutoCompressContext {
		t.Error("expected AutoCompressContext to be true")
	}
	if !cfg.AutoDisableBranching {
		t.Error("expected AutoDisableBranching to be true")
	}
}

func TestNewEngine(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	if engine == nil {
		t.Fatal("expected non-nil engine")
	}
	if engine.config.LowMemoryMB != cfg.LowMemoryMB {
		t.Error("engine config not set correctly")
	}
}

func TestDetermineStrategyDefaults(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	task := TaskConstraints{}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.Mode != ModeFull {
		t.Errorf("expected ModeFull, got %s", strategy.Mode)
	}
	if strategy.ReasoningDepth != model.ReasoningHigh {
		t.Errorf("expected ReasoningHigh, got %v", strategy.ReasoningDepth)
	}
	if strategy.MaxBranches != 10 {
		t.Errorf("expected MaxBranches=10, got %d", strategy.MaxBranches)
	}
	if !strategy.EnableDelegation {
		t.Error("expected EnableDelegation to be true")
	}
	if strategy.PolicyStrictness != PolicyNormal {
		t.Errorf("expected PolicyNormal, got %s", strategy.PolicyStrictness)
	}
	if strategy.ContextWindow != 128000 {
		t.Errorf("expected ContextWindow=128000, got %d", strategy.ContextWindow)
	}
}

func TestDetermineStrategyMobile(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)
	engine.deviceCtx.IsMobile = true

	task := TaskConstraints{}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.Mode != ModeConservative {
		t.Errorf("expected ModeConservative, got %s", strategy.Mode)
	}
	if strategy.MaxBranches != 3 {
		t.Errorf("expected MaxBranches=3, got %d", strategy.MaxBranches)
	}
	if strategy.ContextWindow != 8192 {
		t.Errorf("expected ContextWindow=8192, got %d", strategy.ContextWindow)
	}
	if strategy.CompressionLevel != 1 {
		t.Errorf("expected CompressionLevel=1, got %d", strategy.CompressionLevel)
	}
}

func TestDetermineStrategyLowMemory(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)
	engine.deviceCtx.AvailableRAMMB = 256 // Below 512MB threshold

	task := TaskConstraints{}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.Mode != ModeMinimal {
		t.Errorf("expected ModeMinimal, got %s", strategy.Mode)
	}
	if strategy.ReasoningDepth != model.ReasoningLow {
		t.Errorf("expected ReasoningLow, got %v", strategy.ReasoningDepth)
	}
	if strategy.MaxBranches != 1 {
		t.Errorf("expected MaxBranches=1, got %d", strategy.MaxBranches)
	}
	if strategy.ContextWindow != 4096 {
		t.Errorf("expected ContextWindow=4096, got %d", strategy.ContextWindow)
	}
	if strategy.PolicyStrictness != PolicyStrict {
		t.Errorf("expected PolicyStrict, got %s", strategy.PolicyStrictness)
	}
}

func TestDetermineStrategyOffline(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)
	engine.deviceCtx.IsOffline = true

	task := TaskConstraints{}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.Mode != ModeOffline {
		t.Errorf("expected ModeOffline, got %s", strategy.Mode)
	}
	if strategy.EnableDelegation {
		t.Error("expected EnableDelegation to be false in offline mode")
	}
	if strategy.ReasoningDepth != model.ReasoningLow {
		t.Errorf("expected ReasoningLow, got %v", strategy.ReasoningDepth)
	}
}

func TestDetermineStrategyComplexReasoningError(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)
	engine.deviceCtx.AvailableRAMMB = 256 // Forces low reasoning

	task := TaskConstraints{
		RequireComplexReasoning: true,
	}
	_, err := engine.DetermineStrategy(task)
	if err == nil {
		t.Error("expected error when complex reasoning required but constrained to low")
	}
}

func TestDetermineStrategyCritical(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	task := TaskConstraints{
		Critical: true,
	}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.PolicyStrictness != PolicyDraconian {
		t.Errorf("expected PolicyDraconian, got %s", strategy.PolicyStrictness)
	}
}

func TestDetermineStrategyTimeSensitive(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	task := TaskConstraints{
		TimeSensitive: true,
	}
	strategy, err := engine.DetermineStrategy(task)
	if err != nil {
		t.Fatalf("DetermineStrategy failed: %v", err)
	}

	if strategy.TimeoutMultiplier != 0.5 {
		t.Errorf("expected TimeoutMultiplier=0.5, got %f", strategy.TimeoutMultiplier)
	}
}

func TestAdaptInputNoCompression(t *testing.T) {
	strategy := ExecutionStrategy{CompressionLevel: 0}
	input := "  hello   world  "
	result := AdaptInput(input, strategy)

	if result != input {
		t.Errorf("expected no compression, got %s", result)
	}
}

func TestAdaptInputLightCompression(t *testing.T) {
	strategy := ExecutionStrategy{CompressionLevel: 1}
	input := "hello   world\t\t\ttest\n\n\nend"
	result := AdaptInput(input, strategy)

	// Should normalize whitespace
	if result == input {
		t.Error("expected compression to change input")
	}
	// Should not have multiple consecutive spaces
	for i := 0; i < len(result)-1; i++ {
		if result[i] == ' ' && result[i+1] == ' ' {
			t.Error("found consecutive spaces after light compression")
		}
	}
}

func TestAdaptInputHeavyCompression(t *testing.T) {
	strategy := ExecutionStrategy{CompressionLevel: 2, ContextWindow: 10}
	input := make([]byte, 1000)
	for i := range input {
		input[i] = 'a'
	}

	result := AdaptInput(string(input), strategy)

	if len(result) >= len(input) {
		t.Error("expected heavy compression to reduce size")
	}
	if !contains(result, "truncated") {
		t.Error("expected truncation notice in result")
	}
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestSimplifyTree(t *testing.T) {
	// Create a tree with 5 children
	root := &ReasoningTree{
		Action: "root",
		Reason: "root reason",
		Children: []*ReasoningTree{
			{Action: "child1", Reason: "reason1"},
			{Action: "child2", Reason: "reason2"},
			{Action: "child3", Reason: "reason3"},
			{Action: "child4", Reason: "reason4"},
			{Action: "child5", Reason: "reason5"},
		},
	}

	simplified := SimplifyTree(root, 3)

	if len(simplified.Children) != 3 {
		t.Errorf("expected 3 children after simplification, got %d", len(simplified.Children))
	}
}

func TestSimplifyTreeNil(t *testing.T) {
	result := SimplifyTree(nil, 5)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Action != "simplified" {
		t.Errorf("expected Action='simplified', got %s", result.Action)
	}
}

func TestSimplifyTreeMaxDepthZero(t *testing.T) {
	root := &ReasoningTree{
		Action:   "root",
		Reason:   "reason",
		Children: []*ReasoningTree{{Action: "child"}},
	}

	result := SimplifyTree(root, 0)
	if result.Action != "simplified" {
		t.Errorf("expected simplified tree, got %s", result.Action)
	}
}

func TestShouldPrune(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	strategy := ExecutionStrategy{MaxBranches: 3}

	if engine.ShouldPrune(strategy, 2) {
		t.Error("should not prune at depth 2 with max 3")
	}
	if !engine.ShouldPrune(strategy, 3) {
		t.Error("should prune at depth 3 with max 3")
	}
	if !engine.ShouldPrune(strategy, 4) {
		t.Error("should prune at depth 4 with max 3")
	}
}

func TestShouldPruneNoLimit(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	strategy := ExecutionStrategy{MaxBranches: 0} // No limit

	if engine.ShouldPrune(strategy, 100) {
		t.Error("should not prune when maxBranches is 0")
	}
}

func TestCanDelegate(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	strategy := ExecutionStrategy{EnableDelegation: true}
	if !engine.CanDelegate(strategy) {
		t.Error("should allow delegation when enabled and online")
	}

	strategy.EnableDelegation = false
	if engine.CanDelegate(strategy) {
		t.Error("should not allow delegation when disabled")
	}

	strategy.EnableDelegation = true
	engine.deviceCtx.IsOffline = true
	if engine.CanDelegate(strategy) {
		t.Error("should not allow delegation when offline")
	}

	engine.deviceCtx.IsOffline = false
	engine.deviceCtx.NetworkLatencyMs = 2000 // Above threshold
	if engine.CanDelegate(strategy) {
		t.Error("should not allow delegation with high latency")
	}
}

func TestPolicyOverride(t *testing.T) {
	cfg := DefaultEngineConfig()
	engine := NewEngine(cfg, nil)

	tests := []struct {
		strictness   PolicyLevel
		wantDeny     bool
		wantSigned   bool
		wantAuditAll bool
	}{
		{PolicyNormal, false, false, false},
		{PolicyStrict, true, false, true},
		{PolicyDraconian, true, true, true},
	}

	for _, tt := range tests {
		strategy := ExecutionStrategy{PolicyStrictness: tt.strictness}
		override := engine.PolicyOverride(strategy)

		if override.DenyUnknownTools != tt.wantDeny {
			t.Errorf("%s: DenyUnknownTools=%v, want %v", tt.strictness, override.DenyUnknownTools, tt.wantDeny)
		}
		if override.RequireSignedPacks != tt.wantSigned {
			t.Errorf("%s: RequireSignedPacks=%v, want %v", tt.strictness, override.RequireSignedPacks, tt.wantSigned)
		}
		if override.AuditAll != tt.wantAuditAll {
			t.Errorf("%s: AuditAll=%v, want %v", tt.strictness, override.AuditAll, tt.wantAuditAll)
		}
	}
}

func TestExecutionStrategyIsEdgeMode(t *testing.T) {
	tests := []struct {
		mode     StrategyMode
		expected bool
	}{
		{ModeFull, false},
		{ModeConservative, false},
		{ModeMinimal, true},
		{ModeOffline, true},
	}

	for _, tt := range tests {
		s := ExecutionStrategy{Mode: tt.mode}
		if got := s.IsEdgeMode(); got != tt.expected {
			t.Errorf("IsEdgeMode() for %s = %v, want %v", tt.mode, got, tt.expected)
		}
	}
}

func TestExecutionStrategyContextBudget(t *testing.T) {
	s := ExecutionStrategy{ContextWindow: 10000}
	budget := s.ContextBudget()

	expected := int(float64(10000) * 0.9)
	if budget != expected {
		t.Errorf("expected budget %d, got %d", expected, budget)
	}
}

func TestStrategyFromConfig(t *testing.T) {
	cfg := &config.Config{
		EdgeMode: config.EdgeModeConfig{
			MemoryCapMB:       256,
			SimplifyReasoning: true,
			DisableBranching:  true,
		},
	}

	engineCfg := StrategyFromConfig(cfg)

	if engineCfg.LowMemoryMB != 256 {
		t.Errorf("expected LowMemoryMB=256, got %d", engineCfg.LowMemoryMB)
	}
	if !engineCfg.AutoCompressContext {
		t.Error("expected AutoCompressContext to be true")
	}
	if !engineCfg.AutoDisableBranching {
		t.Error("expected AutoDisableBranching to be true")
	}
}

func TestDetectDeviceContext(t *testing.T) {
	ctx := detectDeviceContext()

	if ctx.CPUCount == 0 {
		t.Error("expected CPUCount > 0")
	}
	// Other fields are platform-specific and may vary
	t.Logf("Device context: CPU=%d, Mobile=%v, RAM=%dMB",
		ctx.CPUCount, ctx.IsMobile, ctx.TotalRAMMB)
}

func BenchmarkAdaptInputLight(b *testing.B) {
	strategy := ExecutionStrategy{CompressionLevel: 1}
	input := "  hello   world  \t\t  test  \n\n  end  "

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AdaptInput(input, strategy)
	}
}

func BenchmarkAdaptInputHeavy(b *testing.B) {
	strategy := ExecutionStrategy{CompressionLevel: 2, ContextWindow: 100}
	input := make([]byte, 10000)
	for i := range input {
		input[i] = 'a'
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AdaptInput(string(input), strategy)
	}
}
