package packloader

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// RuntimeHook defines a function that a pack can register to be called
// at specific points in the execution lifecycle.
type RuntimeHook func(ctx context.Context, event HookEvent) error

// HookEvent carries data about a lifecycle event.
type HookEvent struct {
	Type    HookType        `json:"type"`
	PackID  string          `json:"pack_id"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// HookType identifies when a hook fires.
type HookType string

const (
	HookBeforeExecute HookType = "before_execute"
	HookAfterExecute  HookType = "after_execute"
	HookOnError       HookType = "on_error"
	HookOnLoad        HookType = "on_load"
	HookOnUnload      HookType = "on_unload"
)

// PackCapability represents a concrete capability provided by a pack
// that gets injected into the runtime.
type PackCapability struct {
	PackID      string   `json:"pack_id"`
	CapID       string   `json:"cap_id"`
	Tools       []string `json:"tools"`
	Permissions []string `json:"permissions"`
}

// RuntimeInjector is the single integration point between the pack system
// and the agent runtime. It exposes loaded pack capabilities and hooks
// without allowing packs to mutate the runtime directly.
type RuntimeInjector struct {
	mu           sync.RWMutex
	capabilities map[string][]PackCapability // tool name -> capabilities providing it
	hooks        map[HookType][]hookEntry
	sandbox      *PackSandbox
}

type hookEntry struct {
	packID string
	hook   RuntimeHook
}

// NewRuntimeInjector creates a new injector bound to a sandbox.
func NewRuntimeInjector(sandbox *PackSandbox) *RuntimeInjector {
	return &RuntimeInjector{
		capabilities: make(map[string][]PackCapability),
		hooks:        make(map[HookType][]hookEntry),
		sandbox:      sandbox,
	}
}

// InjectPack registers a pack's declared tools and permissions into the runtime.
// This is the only way packs get wired into the execution engine.
// It does not execute any pack code — no implicit side effects.
func (ri *RuntimeInjector) InjectPack(pack *LoadedPack) error {
	if pack.Manifest == nil {
		return fmt.Errorf("cannot inject pack without manifest")
	}
	if pack.Disabled {
		return fmt.Errorf("cannot inject disabled pack %s: %s", pack.Manifest.Metadata.ID, pack.Error)
	}

	ri.mu.Lock()
	defer ri.mu.Unlock()

	id := pack.Manifest.Metadata.ID
	cap := PackCapability{
		PackID:      id,
		CapID:       id,
		Tools:       pack.Manifest.DeclaredTools,
		Permissions: pack.Manifest.DeclaredPermissions,
	}

	for _, tool := range pack.Manifest.DeclaredTools {
		ri.capabilities[tool] = append(ri.capabilities[tool], cap)
	}

	return nil
}

// EjectPack removes a pack's capabilities from the runtime.
func (ri *RuntimeInjector) EjectPack(packID string) {
	ri.mu.Lock()
	defer ri.mu.Unlock()

	// Remove capabilities
	for tool, caps := range ri.capabilities {
		filtered := make([]PackCapability, 0, len(caps))
		for _, c := range caps {
			if c.PackID != packID {
				filtered = append(filtered, c)
			}
		}
		if len(filtered) > 0 {
			ri.capabilities[tool] = filtered
		} else {
			delete(ri.capabilities, tool)
		}
	}

	// Remove hooks
	for hookType, entries := range ri.hooks {
		filtered := make([]hookEntry, 0, len(entries))
		for _, e := range entries {
			if e.packID != packID {
				filtered = append(filtered, e)
			}
		}
		ri.hooks[hookType] = filtered
	}
}

// RegisterHook registers a lifecycle hook for a pack.
func (ri *RuntimeInjector) RegisterHook(packID string, hookType HookType, hook RuntimeHook) {
	ri.mu.Lock()
	defer ri.mu.Unlock()
	ri.hooks[hookType] = append(ri.hooks[hookType], hookEntry{packID: packID, hook: hook})
}

// FireHooks executes all hooks of a given type, in registration order.
// Hook errors are collected but do not stop other hooks from running.
func (ri *RuntimeInjector) FireHooks(ctx context.Context, hookType HookType, payload json.RawMessage) []error {
	ri.mu.RLock()
	entries := make([]hookEntry, len(ri.hooks[hookType]))
	copy(entries, ri.hooks[hookType])
	ri.mu.RUnlock()

	var errs []error
	for _, entry := range entries {
		event := HookEvent{
			Type:    hookType,
			PackID:  entry.packID,
			Payload: payload,
		}
		if err := entry.hook(ctx, event); err != nil {
			errs = append(errs, fmt.Errorf("hook %s from pack %s: %w", hookType, entry.packID, err))
		}
	}
	return errs
}

// ResolveCapability returns which pack(s) provide a given tool.
func (ri *RuntimeInjector) ResolveCapability(toolName string) []PackCapability {
	ri.mu.RLock()
	defer ri.mu.RUnlock()

	caps, ok := ri.capabilities[toolName]
	if !ok {
		return nil
	}
	out := make([]PackCapability, len(caps))
	copy(out, caps)
	return out
}

// ListCapabilities returns all registered capabilities.
func (ri *RuntimeInjector) ListCapabilities() map[string][]PackCapability {
	ri.mu.RLock()
	defer ri.mu.RUnlock()

	out := make(map[string][]PackCapability, len(ri.capabilities))
	for k, v := range ri.capabilities {
		c := make([]PackCapability, len(v))
		copy(c, v)
		out[k] = c
	}
	return out
}

// ExecuteWithPack runs a tool call through the sandbox enforcement layer,
// ensuring the pack has declared access to the tool.
func (ri *RuntimeInjector) ExecuteWithPack(ctx context.Context, packID, toolName string, fn func(context.Context) (any, error)) (any, error) {
	return ri.sandbox.EnforcedCall(ctx, packID, toolName, fn)
}
