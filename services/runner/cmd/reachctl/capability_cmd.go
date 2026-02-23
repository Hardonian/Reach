package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Capability represents a capability/permission in the system
type Capability struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Category        string   `json:"category"` // core, plugin, system
	RequiresConfirm bool     `json:"requires_confirmation"`
	RiskLevel       string   `json:"risk_level"` // low, medium, high, critical
	AllowedActions  []string `json:"allowed_actions"`
}

// CapabilityRegistry holds all registered capabilities
type CapabilityRegistry struct {
	CoreCapabilities     []Capability `json:"core_capabilities"`
	PluginCapabilities   []Capability `json:"plugin_capabilities"`
	SystemCapabilities   []Capability `json:"system_capabilities"`
}

// CapabilityCheckResult represents the result of a capability check
type CapabilityCheckResult struct {
	Allowed       bool     `json:"allowed"`
	Reason        string   `json:"reason"`
	RequiresConfirm bool   `json:"requires_confirmation"`
	RiskLevel     string   `json:"risk_level"`
}

// runCapability handles capability-related commands
func runCapability(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	if len(args) < 1 {
		fmt.Fprintln(errOut, "Usage: reachctl capability <list|check|register>")
		return 1
	}

	switch args[0] {
	case "list":
		return runCapabilityList(ctx, dataRoot, args[1:], out, errOut)
	case "check":
		return runCapabilityCheck(ctx, dataRoot, args[1:], out, errOut)
	case "register":
		return runCapabilityRegister(ctx, dataRoot, args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "Unknown capability command: %s\n", args[0])
		return 1
	}
}

// runCapabilityList lists all registered capabilities
func runCapabilityList(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("capability list", flag.ContinueOnError)
	category := fs.String("category", "", "Filter by category (core, plugin, system)")
	_ = fs.Parse(args)

	registry := getDefaultCapabilities()

	// Filter by category if specified
	if *category != "" {
		switch *category {
		case "core":
			return writeJSON(out, map[string]any{"capabilities": registry.CoreCapabilities})
		case "plugin":
			return writeJSON(out, map[string]any{"capabilities": registry.PluginCapabilities})
		case "system":
			return writeJSON(out, map[string]any{"capabilities": registry.SystemCapabilities})
		default:
			fmt.Fprintf(errOut, "Unknown category: %s\n", *category)
			return 1
		}
	}

	return writeJSON(out, map[string]any{
		"core_capabilities":   registry.CoreCapabilities,
		"plugin_capabilities": registry.PluginCapabilities,
		"system_capabilities": registry.SystemCapabilities,
	})
}

// runCapabilityCheck checks if an action is allowed
func runCapabilityCheck(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("capability check", flag.ContinueOnError)
	action := fs.String("action", "", "Action to check")
	_ = fs.Parse(args)

	if *action == "" {
		fmt.Fprintln(errOut, "Error: --action is required")
		return 1
	}

	result := checkCapability(*action)
	return writeJSON(out, result)
}

// runCapabilityRegister registers a new capability
func runCapabilityRegister(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("capability register", flag.ContinueOnError)
	name := fs.String("name", "", "Capability name")
	description := fs.String("description", "", "Capability description")
	category := fs.String("category", "plugin", "Category (core, plugin, system)")
	riskLevel := fs.String("risk-level", "low", "Risk level (low, medium, high, critical)")
	requiresConfirm := fs.Bool("requires-confirm", false, "Requires user confirmation")
	_ = fs.Parse(args)

	if *name == "" {
		fmt.Fprintln(errOut, "Error: --name is required")
		return 1
	}

	cap := Capability{
		Name:            *name,
		Description:     *description,
		Category:        *category,
		RequiresConfirm: *requiresConfirm,
		RiskLevel:       *riskLevel,
		AllowedActions:  []string{*name},
	}

	// Save to capabilities file
	capPath := filepath.Join(dataRoot, "capabilities.json")
	var caps []Capability
	
	if data, err := os.ReadFile(capPath); err == nil {
		json.Unmarshal(data, &caps)
	}
	
	caps = append(caps, cap)
	
	if data, err := json.MarshalIndent(caps, "", "  "); err == nil {
		os.WriteFile(capPath, data, 0644)
	}

	fmt.Fprintf(out, "Registered capability: %s\n", *name)
	return writeJSON(out, cap)
}

// checkCapability checks if an action is allowed with current settings
func checkCapability(action string) CapabilityCheckResult {
	registry := getDefaultCapabilities()
	
	// Check if action exists in any capability
	allCaps := append(registry.CoreCapabilities, registry.PluginCapabilities...)
	allCaps = append(allCaps, registry.SystemCapabilities...)
	
	for _, cap := range allCaps {
		for _, a := range cap.AllowedActions {
			if a == action {
				return CapabilityCheckResult{
					Allowed:        true,
					Reason:         fmt.Sprintf("Action '%s' is allowed by capability '%s'", action, cap.Name),
					RequiresConfirm: cap.RequiresConfirm,
					RiskLevel:      cap.RiskLevel,
				}
			}
		}
	}
	
	return CapabilityCheckResult{
		Allowed:       false,
		Reason:        fmt.Sprintf("Action '%s' is not registered", action),
		RequiresConfirm: false,
		RiskLevel:     "unknown",
	}
}

// getDefaultCapabilities returns the default capability registry
func getDefaultCapabilities() CapabilityRegistry {
	return CapabilityRegistry{
		CoreCapabilities: []Capability{
			{
				Name:            "run:execute",
				Description:     "Execute a pack or run",
				Category:        "core",
				RequiresConfirm: false,
				RiskLevel:       "low",
				AllowedActions:  []string{"run:execute", "run:start"},
			},
			{
				Name:            "capsule:create",
				Description:     "Create a capsule bundle",
				Category:        "core",
				RequiresConfirm: false,
				RiskLevel:       "low",
				AllowedActions:  []string{"capsule:create", "capsule:export"},
			},
			{
				Name:            "capsule:replay",
				Description:     "Replay a capsule",
				Category:        "core",
				RequiresConfirm: false,
				RiskLevel:       "low",
				AllowedActions:  []string{"capsule:replay"},
			},
		},
		PluginCapabilities: []Capability{
			{
				Name:            "plugin:install",
				Description:     "Install a plugin",
				Category:        "plugin",
				RequiresConfirm: true,
				RiskLevel:       "medium",
				AllowedActions:  []string{"plugin:install", "plugin:add"},
			},
			{
				Name:            "plugin:execute",
				Description:     "Execute a plugin",
				Category:        "plugin",
				RequiresConfirm: true,
				RiskLevel:       "high",
				AllowedActions:  []string{"plugin:execute"},
			},
		},
		SystemCapabilities: []Capability{
			{
				Name:            "system:config",
				Description:     "Modify system configuration",
				Category:        "system",
				RequiresConfirm: true,
				RiskLevel:       "critical",
				AllowedActions:  []string{"system:config", "system:settings"},
			},
			{
				Name:            "system:admin",
				Description:     "Administrative operations",
				Category:        "system",
				RequiresConfirm: true,
				RiskLevel:       "critical",
				AllowedActions:  []string{"system:admin", "system:reset"},
			},
			{
				Name:            "data:delete",
				Description:     "Delete data or records",
				Category:        "system",
				RequiresConfirm: true,
				RiskLevel:       "high",
				AllowedActions:  []string{"data:delete", "retention:prune"},
			},
		},
	}
}
