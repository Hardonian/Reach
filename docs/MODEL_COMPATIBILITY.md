# Model Compatibility Reach's model abstraction layer provides forward compatibility for emerging LLM capabilities.

## Supported Model Types ### Current

| Type | Examples | Status |
|------|----------|--------|
| Hosted Cloud | OpenAI GPT-4, Anthropic Claude, Google Gemini | ✅ Supported |
| Local OSS | Ollama (llama3, mistral, phi3) | ✅ Supported |
| Small Mode | Deterministic fallback | ✅ Supported |

### Future Roadmap | Type | Examples | ETA |
|------|----------|-----|
| Ultra-Long Context | 1M+ token models | 2025 Q2 |
| Tool-Native Planning | Models with built-in agent loops | 2025 Q1 |
| Ultra-Small Distilled | <1B parameter models | Available |
| Multimodal | Vision+Language models | 2025 Q2 |

## Context Window Negotiation Reach automatically negotiates context windows with models:

```go
negotiator := model.NewContextNegotiator(128000) // Target 128K
result := negotiator.Negotiate(adapter, estimatedTokens)

if result.RequiresChunking {
    // Break into chunks
    for i := 0; i < result.ChunkCount; i++ {
        processChunk(i, result.WindowSize)
    }
}
```

### Chunking Strategy For very long contexts that exceed model limits:

```go
chunker := model.NewPromptChunker(2048)
chunks := chunker Chunk(longPrompt)

for i, chunk := range chunks {
    result, err := adapter.Generate(ctx, GenerateInput{
        Messages: []Message{{Role: "user", Content: chunk}},
    }, opts)
}
```

## Token Budgeting Reach allocates tokens across components:

```go
budget := model.CalculateBudget(model.BudgetConfig{
    TotalTokens:      128000,
    ResponseTokens:   4096,
    ToolCount:        5,
    ComplexityFactor: 1.0,
})

// budget.SystemPrompt = 500
// budget.UserInput = ~115000
// budget.ToolDefinitions = 1000
// budget.ResponseBuffer = 4096
// budget.Reserved = 12800 (10%)
```

## Capability Detection Probe model capabilities at runtime:

```go
detector := model.NewCapabilityDetector()
result := detector.Detect(adapter)

for _, cap := range result.SupportedCapabilities {
    fmt.Println("Supports:", cap)
}
```

### Detected Capabilities | Capability | Detection Method |
|------------|------------------|
| `json_mode` | JSON output test |
| `tool_use` | Tool invocation test |
| `long_context` | 32K+ context probe |
| `streaming` | SSE support check |
| `reasoning` | Multi-step task test |

## Version Compatibility ### Current Support Matrix

| Model Version | Status | Notes |
|---------------|--------|-------|
| 1.0 - 2.0 | ✅ Supported | Legacy tool format |
| 2.0 - 3.0 | ✅ Fully Supported | Current standard |
| 3.0+ | ⚠️ Beta | New features may require flags |

### Version Validation ```go
err := model.ValidateCompatibility("2.5")
if err != nil {
    // Model too new or too old
    log.Warn(err)
}
```

## Feature Flags Experimental features are gated:

```go
if model.CheckFeature("native_planning", caps) {
    // Use model's native planning
} else {
    // Use Reach's planning layer
}
```

### Available Feature Flags | Feature | Requires | Status |
|---------|----------|--------|
| `native_planning` | `nativePlanning` capability | Alpha |
| `ultra_context` | `ultraLongContext` capability | Beta |
| `streaming_tools` | `streamingTools` capability | Beta |
| `multimodal_input` | `multiModal` capability | Alpha |

## Migration Guides ### From Tool Format V1 to V2

```go
// V1 - Simple
Tool{Name: "read", Params: params}

// V2 - Streaming support
Tool{
    Name: "read",
    Params: params,
    Streaming: true,  // New
    Parallel: false,  // New
}
```

### From 4K to 128K+ Context ```go
// Old: Manual chunking required
chunks := manualChunk(prompt, 4000)

// New: Automatic negotiation
config, _ := model.CreateFutureProofConfig(adapter, input, opts)
if config.Negotiated.RequiresChunking {
    // Reach handles chunking
}
```

## Future-Proof Config Create configurations that work across model versions:

```go
config, err := model.CreateFutureProofConfig(adapter, input, opts)
if err != nil {
    return err
}

// Use negotiated parameters
window := config.Negotiated.WindowSize
budget := config.Budget
```

## Distilled Model Support Ultra-small models (<1B params) work in Edge Mode:

```bash
# Pull tiny model ollama pull tinyllama:1.1b

# Auto-detected as edge-capable reach run --model-mode=auto
```

Characteristics:
- No tool calling
- No complex reasoning
- Fast inference (~100ms/token)
- Works offline

## Compatibility Layer Adapt between model versions:

```go
layer := model.NewCompatibilityLayer("v2")
adapted := layer.AdaptRequest(request)

// v1 models get v1 format
// v2 models get v2 format
// v3 models get v3 format
```

## Deprecation Policy | Feature | Deprecated | Removal |
|---------|------------|---------|
| <4K context windows | 2025-01 | 2025-06 |
| Tool format v1 | 2025-03 | 2025-09 |
| Non-streaming adapters | 2025-06 | 2025-12 |

## Best Practices 1. **Use capability detection** - Don't assume model capabilities
2. **Handle negotiation failures** - Always have a fallback
3. **Budget conservatively** - Leave 10% buffer for overhead
4. **Test with small models** - Ensures edge mode compatibility
5. **Version pin in production** - Avoid surprise breaking changes

## Testing Compatibility ```bash
# Test with specific model reach run --model=hosted --model-id=gpt-4

# Test with fallback chain reach run --model-mode=auto --verbose

# Verify edge mode works reach run --edge --verify-determinism
```
