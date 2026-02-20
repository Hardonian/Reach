// Package model provides the common provider interface for LLM integrations.
package model

import (
	"context"
	"encoding/json"
	"io"
)

// Provider defines the common interface for all LLM providers.
// This interface abstracts OpenAI, Anthropic, Hugging Face, and local models.
type Provider interface {
	// Generate produces a complete response from the model.
	// This is a blocking call that returns the full response.
	Generate(ctx context.Context, req GenerationRequest) (GenerationResponse, error)

	// Stream produces a streaming response from the model.
	// Returns a ReadCloser that streams Server-Sent Events (SSE).
	Stream(ctx context.Context, req GenerationRequest) (io.ReadCloser, error)

	// GetCapabilities returns the capabilities of this provider.
	GetCapabilities() ProviderCapabilities

	// GetModels returns a list of available models from this provider.
	GetModels(ctx context.Context) ([]ModelInfo, error)

	// ValidateConfig checks if the provider is properly configured.
	ValidateConfig() error

	// Name returns the provider identifier (e.g., "openai", "anthropic", "huggingface").
	Name() string
}

// GenerationRequest contains all parameters for a generation request.
type GenerationRequest struct {
	// Model is the model identifier (e.g., "gpt-4", "claude-3-opus-20240229", "meta-llama/Llama-2-70b-chat-hf")
	Model string `json:"model"`

	// Messages is the conversation history.
	Messages []Message `json:"messages"`

	// Temperature controls randomness (0.0 to 2.0).
	Temperature float64 `json:"temperature,omitempty"`

	// MaxTokens limits the response length.
	MaxTokens int `json:"max_tokens,omitempty"`

	// TopP is the nucleus sampling parameter.
	TopP float64 `json:"top_p,omitempty"`

	// TopK limits the token selection to top K tokens.
	TopK int `json:"top_k,omitempty"`

	// StopSequences are sequences that stop generation.
	StopSequences []string `json:"stop,omitempty"`

	// Tools defines available function calling tools.
	Tools []ToolDefinition `json:"tools,omitempty"`

	// ToolChoice controls tool usage ("none", "auto", or specific tool).
	ToolChoice string `json:"tool_choice,omitempty"`

	// ResponseFormat constrains the output format.
	ResponseFormat *ResponseFormat `json:"response_format,omitempty"`

	// SystemPrompt is the system-level instruction.
	SystemPrompt string `json:"-"`

	// Seed enables deterministic sampling.
	Seed *int `json:"seed,omitempty"`
}

// ResponseFormat constrains model output.
type ResponseFormat struct {
	Type       string          `json:"type"` // "text" or "json_object" or "json_schema"
	JSONSchema json.RawMessage `json:"json_schema,omitempty"`
}

// GenerationResponse is the standardized response from any provider.
type GenerationResponse struct {
	// ID is a unique identifier for this generation.
	ID string `json:"id"`

	// Content is the generated text.
	Content string `json:"content"`

	// ToolCalls contains any tool invocations requested by the model.
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`

	// FinishReason indicates why generation stopped.
	FinishReason FinishReason `json:"finish_reason"`

	// Usage contains token consumption statistics.
	Usage TokenUsage `json:"usage"`

	// Model is the model that generated this response.
	Model string `json:"model"`

	// Provider is the provider that generated this response.
	Provider string `json:"provider"`

	// CreatedAt is the Unix timestamp of generation.
	CreatedAt int64 `json:"created_at"`

	// Metadata contains provider-specific information.
	Metadata map[string]any `json:"metadata,omitempty"`
}

// FinishReason indicates why generation stopped.
type FinishReason string

const (
	FinishReasonStop          FinishReason = "stop"
	FinishReasonLength        FinishReason = "length"
	FinishReasonToolCalls     FinishReason = "tool_calls"
	FinishReasonContentFilter FinishReason = "content_filter"
	FinishReasonError         FinishReason = "error"
)

// ModelInfo describes an available model.
type ModelInfo struct {
	// ID is the model identifier.
	ID string `json:"id"`

	// Name is the human-readable model name.
	Name string `json:"name"`

	// Provider is the provider offering this model.
	Provider string `json:"provider"`

	// Capabilities describes what this model can do.
	Capabilities ProviderCapabilities `json:"capabilities"`

	// Pricing information (if available).
	Pricing ModelPricing `json:"pricing,omitempty"`

	// ContextWindow is the maximum context size.
	ContextWindow int `json:"context_window"`

	// Description is a brief model description.
	Description string `json:"description,omitempty"`
}

// ModelPricing contains cost information.
type ModelPricing struct {
	InputCostPer1K  float64 `json:"input_cost_per_1k"`
	OutputCostPer1K float64 `json:"output_cost_per_1k"`
	Currency        string  `json:"currency"`
}

// ProviderCapabilities describes provider/model capabilities.
type ProviderCapabilities struct {
	// Streaming indicates if the provider supports streaming responses.
	Streaming bool `json:"streaming"`

	// ToolCalling indicates if the provider supports function calling.
	ToolCalling bool `json:"tool_calling"`

	// JSONMode indicates if the provider supports constrained JSON output.
	JSONMode bool `json:"json_mode"`

	// Vision indicates if the provider supports image inputs.
	Vision bool `json:"vision"`

	// MaxContextTokens is the maximum context window size.
	MaxContextTokens int `json:"max_context_tokens"`

	// MaxOutputTokens is the maximum response length.
	MaxOutputTokens int `json:"max_output_tokens"`

	// SupportedModels lists explicitly supported models.
	SupportedModels []string `json:"supported_models,omitempty"`
}

// StreamEvent represents a single event in a streaming response.
type StreamEvent struct {
	// Type is the event type ("content", "tool_call", "error", "done").
	Type string `json:"type"`

	// Content is the text delta (for "content" events).
	Content string `json:"content,omitempty"`

	// ToolCall contains partial tool call data.
	ToolCall *ToolCall `json:"tool_call,omitempty"`

	// Usage contains token usage (often only in final event).
	Usage *TokenUsage `json:"usage,omitempty"`

	// FinishReason indicates completion (in final event).
	FinishReason FinishReason `json:"finish_reason,omitempty"`

	// Error contains error information.
	Error *StreamError `json:"error,omitempty"`
}

// StreamError represents a streaming error.
type StreamError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ProviderConfig contains common configuration for all providers.
type ProviderConfig struct {
	// APIKey is the authentication key.
	APIKey string `json:"-" env:"API_KEY"`

	// BaseURL is the API endpoint (for custom/self-hosted deployments).
	BaseURL string `json:"base_url,omitempty" env:"BASE_URL"`

	// Timeout is the request timeout in seconds.
	Timeout int `json:"timeout,omitempty" env:"TIMEOUT" default:"30"`

	// MaxRetries is the number of retry attempts.
	MaxRetries int `json:"max_retries,omitempty" env:"MAX_RETRIES" default:"3"`

	// RateLimitRPM is the rate limit in requests per minute.
	RateLimitRPM int `json:"rate_limit_rpm,omitempty" env:"RATE_LIMIT_RPM" default:"60"`

	// OrganizationID is used for enterprise/team billing.
	OrganizationID string `json:"organization_id,omitempty" env:"ORGANIZATION_ID"`
}

// IsConfigured returns true if the provider has the minimum required configuration.
func (c ProviderConfig) IsConfigured() bool {
	return c.APIKey != ""
}
