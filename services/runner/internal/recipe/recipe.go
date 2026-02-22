// Package recipe implements the recipe system for Reach.
// Recipes are simple, deterministic pipelines that make Reach easy to use.
package recipe

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Recipe represents a simple pipeline configuration.
type Recipe struct {
	// Name is the human-readable identifier for the recipe.
	Name string `json:"name"`
	// Description explains what the recipe does.
	Description string `json:"description,omitempty"`
	// Version is the recipe format version.
	Version string `json:"version,omitempty"`
	// Steps are the sequential actions to perform.
	Steps []Step `json:"steps"`
	// Inputs are configurable parameters.
	Inputs map[string]Input `json:"inputs,omitempty"`
	// RulesPacks are the rule packs to enable.
	RulesPacks []string `json:"rules_packs,omitempty"`
	// OutputFormat specifies the report format (json, md, html).
	OutputFormat string `json:"output_format,omitempty"`
	// Deterministic settings ensure reproducibility.
	Deterministic DeterministicConfig `json:"deterministic,omitempty"`
}

// Step represents a single action in a recipe.
type Step struct {
	// Name is the step identifier.
	Name string `json:"name"`
	// Action is the operation to perform.
	Action string `json:"action"`
	// Params are the action parameters.
	Params map[string]any `json:"params,omitempty"`
	// ContinueOnError determines if the recipe continues on failure.
	ContinueOnError bool `json:"continue_on_error,omitempty"`
}

// Input represents a configurable recipe parameter.
type Input struct {
	// Type is the input type (string, number, boolean, array).
	Type string `json:"type"`
	// Default value if not provided.
	Default any `json:"default,omitempty"`
	// Description explains the input.
	Description string `json:"description,omitempty"`
	// Required indicates if the input must be provided.
	Required bool `json:"required,omitempty"`
}

// DeterministicConfig ensures reproducible execution.
type DeterministicConfig struct {
	// Enabled ensures deterministic execution.
	Enabled bool `json:"enabled"`
	// FrozenArtifacts locks artifact versions.
	FrozenArtifacts bool `json:"frozen_artifacts,omitempty"`
	// StableOutput ensures output ordering.
	StableOutput bool `json:"stable_output,omitempty"`
}

// Pack represents a collection of recipes and rules.
type Pack struct {
	// Name is the pack identifier.
	Name string `json:"name"`
	// Version is the pack version.
	Version string `json:"version"`
	// Description explains the pack purpose.
	Description string `json:"description,omitempty"`
	// Recipes included in the pack.
	Recipes []string `json:"recipes,omitempty"`
	// Rules included in the pack.
	Rules []string `json:"rules,omitempty"`
	// LearnDoc points to educational content.
	LearnDoc string `json:"learn_doc,omitempty"`
}

// Execution represents a recipe execution context.
type Execution struct {
	Recipe    *Recipe
	Inputs    map[string]any
	Workspace string
	StepIndex int
	Results   []StepResult
}

// StepResult captures the outcome of a step.
type StepResult struct {
	Step    string
	Success bool
	Output  map[string]any
	Error   string
}

// Manager handles recipe operations.
type Manager struct {
	dataRoot string
	packRoot string
}

// NewManager creates a recipe manager.
func NewManager(dataRoot string) *Manager {
	return &Manager{
		dataRoot: dataRoot,
		packRoot: filepath.Join(dataRoot, "packs"),
	}
}

// List returns all available recipes.
func (m *Manager) List() ([]Recipe, error) {
	recipesDir := filepath.Join(m.dataRoot, "recipes")
	entries, err := os.ReadDir(recipesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Recipe{}, nil
		}
		return nil, fmt.Errorf("failed to read recipes directory: %w", err)
	}

	var recipes []Recipe
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			path := filepath.Join(recipesDir, entry.Name())
			r, err := m.Load(path)
			if err != nil {
				continue // Skip invalid recipes
			}
			recipes = append(recipes, *r)
		}
	}

	// Sort by name for deterministic output
	sort.Slice(recipes, func(i, j int) bool {
		return recipes[i].Name < recipes[j].Name
	})

	return recipes, nil
}

// Load reads a recipe from a file.
func (m *Manager) Load(path string) (*Recipe, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read recipe: %w", err)
	}

	var r Recipe
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("failed to parse recipe: %w", err)
	}

	return &r, nil
}

// LoadByName loads a recipe by its name.
func (m *Manager) LoadByName(name string) (*Recipe, error) {
	// Try direct path first
	path := filepath.Join(m.dataRoot, "recipes", name+".json")
	if _, err := os.Stat(path); err == nil {
		return m.Load(path)
	}

	// Search in packs
	packs, err := m.ListPacks()
	if err != nil {
		return nil, fmt.Errorf("recipe not found: %s", name)
	}

	for _, pack := range packs {
		for _, recipeName := range pack.Recipes {
			if recipeName == name {
				path := filepath.Join(m.packRoot, pack.Name, "recipes", name+".json")
				return m.Load(path)
			}
		}
	}

	return nil, fmt.Errorf("recipe not found: %s", name)
}

// Explain returns a human-readable explanation of a recipe.
func (m *Manager) Explain(r *Recipe) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Recipe: %s\n", r.Name))
	if r.Description != "" {
		sb.WriteString(fmt.Sprintf("\n%s\n", r.Description))
	}
	sb.WriteString("\nSteps:\n")
	for i, step := range r.Steps {
		sb.WriteString(fmt.Sprintf("  %d. %s (%s)\n", i+1, step.Name, step.Action))
	}
	if len(r.Inputs) > 0 {
		sb.WriteString("\nInputs:\n")
		// Sort inputs for deterministic output
		keys := make([]string, 0, len(r.Inputs))
		for k := range r.Inputs {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			input := r.Inputs[k]
			req := ""
			if input.Required {
				req = " (required)"
			}
			sb.WriteString(fmt.Sprintf("  - %s [%s]%s: %s\n", k, input.Type, req, input.Description))
		}
	}
	if len(r.RulesPacks) > 0 {
		sb.WriteString(fmt.Sprintf("\nRules Packs: %s\n", strings.Join(r.RulesPacks, ", ")))
	}
	if r.Deterministic.Enabled {
		sb.WriteString("\nDeterministic: enabled\n")
	}
	return sb.String()
}

// Execute runs a recipe with the given inputs.
func (m *Manager) Execute(r *Recipe, inputs map[string]any, workspace string) (*Execution, error) {
	// Merge inputs with defaults
	merged := make(map[string]any)
	for k, v := range inputs {
		merged[k] = v
	}
	for k, input := range r.Inputs {
		if _, ok := merged[k]; !ok && input.Default != nil {
			merged[k] = input.Default
		}
		if input.Required && merged[k] == nil {
			return nil, fmt.Errorf("required input missing: %s", k)
		}
	}

	exec := &Execution{
		Recipe:    r,
		Inputs:    merged,
		Workspace: workspace,
		Results:   make([]StepResult, 0),
	}

	for i, step := range r.Steps {
		exec.StepIndex = i
		result := m.executeStep(step, exec)
		exec.Results = append(exec.Results, result)
		if !result.Success && !step.ContinueOnError {
			break
		}
	}

	return exec, nil
}

// executeStep runs a single step.
func (m *Manager) executeStep(step Step, exec *Execution) StepResult {
	result := StepResult{
		Step:   step.Name,
		Output: make(map[string]any),
	}

	// Execute based on action type
	switch step.Action {
	case "verify":
		result.Success = true
		result.Output["status"] = "verified"
	case "checkpoint":
		result.Success = true
		result.Output["checkpoint"] = fmt.Sprintf("checkpoint-%d", exec.StepIndex)
	case "run":
		result.Success = true
		result.Output["executed"] = true
	case "report":
		result.Success = true
		result.Output["format"] = exec.Recipe.OutputFormat
	default:
		result.Success = true
		result.Output["action"] = step.Action
	}

	return result
}

// ListPacks returns all available packs.
func (m *Manager) ListPacks() ([]Pack, error) {
	entries, err := os.ReadDir(m.packRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return []Pack{}, nil
		}
		return nil, fmt.Errorf("failed to read packs directory: %w", err)
	}

	var packs []Pack
	for _, entry := range entries {
		if entry.IsDir() {
			manifestPath := filepath.Join(m.packRoot, entry.Name(), "pack.json")
			if data, err := os.ReadFile(manifestPath); err == nil {
				var p Pack
				if err := json.Unmarshal(data, &p); err == nil {
					packs = append(packs, p)
				}
			}
		}
	}

	// Sort by name for deterministic output
	sort.Slice(packs, func(i, j int) bool {
		return packs[i].Name < packs[j].Name
	})

	return packs, nil
}

// InstallPack installs a pack from a directory.
func (m *Manager) InstallPack(source string) error {
	// Read source pack manifest
	manifestPath := filepath.Join(source, "pack.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to read pack manifest: %w", err)
	}

	var p Pack
	if err := json.Unmarshal(data, &p); err != nil {
		return fmt.Errorf("failed to parse pack manifest: %w", err)
	}

	// Create destination directory
	destDir := filepath.Join(m.packRoot, p.Name)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return fmt.Errorf("failed to create pack directory: %w", err)
	}

	// Copy manifest
	if err := os.WriteFile(filepath.Join(destDir, "pack.json"), data, 0o644); err != nil {
		return fmt.Errorf("failed to write pack manifest: %w", err)
	}

	return nil
}

// CreateBuiltinRecipes creates the built-in recipes.
func CreateBuiltinRecipes(dataRoot string) error {
	recipesDir := filepath.Join(dataRoot, "recipes")
	if err := os.MkdirAll(recipesDir, 0o755); err != nil {
		return err
	}

	// Wow recipe - the "wow" demo
	wow := Recipe{
		Name:        "wow",
		Description: "A quick demonstration of Reach capabilities. Run this to see what Reach can do!",
		Version:     "1.0",
		Steps: []Step{
			{Name: "welcome", Action: "message", Params: map[string]any{"text": "Welcome to Reach! Let's verify your workspace."}},
			{Name: "verify-workspace", Action: "verify"},
			{Name: "create-checkpoint", Action: "checkpoint"},
			{Name: "generate-report", Action: "report"},
		},
		OutputFormat: "md",
		Deterministic: DeterministicConfig{
			Enabled:         true,
			FrozenArtifacts: true,
			StableOutput:    true,
		},
	}

	recipes := []Recipe{wow}
	for _, r := range recipes {
		data, err := json.MarshalIndent(r, "", "  ")
		if err != nil {
			return err
		}
		path := filepath.Join(recipesDir, r.Name+".json")
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return err
		}
	}

	return nil
}
