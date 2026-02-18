// Package pack provides pack validation CLI commands.
package pack

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"reach/pack-devkit/harness"
)

// ValidateCommand handles the 'reach pack validate' command.
type ValidateCommand struct {
	PackPath    string
	OutputJSON  bool
	FixturesDir string
}

// NewValidateCommand creates a new validate command.
func NewValidateCommand(packPath string) *ValidateCommand {
	return &ValidateCommand{
		PackPath:    packPath,
		FixturesDir: filepath.Join(packPath, "..", "fixtures"),
	}
}

// Execute runs the validate command.
func (c *ValidateCommand) Execute() error {
	// Verify pack exists
	packJSONPath := filepath.Join(c.PackPath, "pack.json")
	if _, err := os.Stat(packJSONPath); os.IsNotExist(err) {
		return fmt.Errorf("pack.json not found at %s", c.PackPath)
	}

	// Create validator
	validator := harness.NewRegistryValidator(c.FixturesDir)

	// Run validation
	result, err := validator.ValidatePack(c.PackPath)
	if err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Output results
	if c.OutputJSON {
		data, err := result.ToJSON()
		if err != nil {
			return fmt.Errorf("failed to serialize result: %w", err)
		}
		fmt.Println(string(data))
	} else {
		fmt.Println(result.ToHuman())
	}

	// Exit with error code if validation failed
	if !result.Passed {
		os.Exit(1)
	}

	return nil
}

// ValidateFlags represents command-line flags for validation.
type ValidateFlags struct {
	JSON     bool   `json:"json"`
	Fixtures string `json:"fixtures"`
}

// RunValidate is the entry point for the validate command.
func RunValidate(args []string, flags ValidateFlags) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: reach pack validate <path> [--json] [--fixtures <dir>]")
	}

	packPath := args[0]
	cmd := NewValidateCommand(packPath)
	cmd.OutputJSON = flags.JSON
	if flags.Fixtures != "" {
		cmd.FixturesDir = flags.Fixtures
	}

	return cmd.Execute()
}

// PrintValidateHelp prints help for the validate command.
func PrintValidateHelp() {
	fmt.Println("Usage: reach pack validate <path> [options]")
	fmt.Println("")
	fmt.Println("Validate a pack for registry inclusion.")
	fmt.Println("")
	fmt.Println("Options:")
	fmt.Println("  --json          Output results as JSON")
	fmt.Println("  --fixtures      Path to fixtures directory")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  reach pack validate ./my-pack")
	fmt.Println("  reach pack validate ./my-pack --json")
}

// RegistryPRCommand handles the 'reach verify:registry-pr' command.
type RegistryPRCommand struct {
	RegistryDir string
	OutputJSON  bool
}

// NewRegistryPRCommand creates a new registry PR command.
func NewRegistryPRCommand(registryDir string) *RegistryPRCommand {
	return &RegistryPRCommand{
		RegistryDir: registryDir,
		OutputJSON:  false,
	}
}

// Execute runs the registry PR validation.
func (c *RegistryPRCommand) Execute() error {
	// Create validator
	validator := harness.NewRegistryValidator(filepath.Join(c.RegistryDir, "fixtures"))

	// Validate all packs in registry
	results, err := validator.ValidateRegistryPR(c.RegistryDir)
	if err != nil {
		return fmt.Errorf("registry validation failed: %w", err)
	}

	// Count results
	passed := 0
	failed := 0
	for _, result := range results {
		if result.Passed {
			passed++
		} else {
			failed++
		}
	}

	// Output results
	if c.OutputJSON {
		// JSON output
		output := struct {
			Total  int                  `json:"total"`
			Passed int                  `json:"passed"`
			Failed int                  `json:"failed"`
			Packs  []*harness.ValidationResult `json:"packs"`
		}{
			Total:  len(results),
			Passed: passed,
			Failed: failed,
			Packs:  results,
		}

		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
	} else {
		// Human readable output
		fmt.Println("========================================")
		fmt.Println("Registry PR Validation Results")
		fmt.Println("========================================")
		fmt.Printf("\nTotal packs: %d\n", len(results))
		fmt.Printf("Passed: %d ✅\n", passed)
		fmt.Printf("Failed: %d ❌\n", failed)

		if len(results) > 0 {
			fmt.Println("\n----------------------------------------")
			fmt.Println("Pack Details:")
			fmt.Println("----------------------------------------")
			for _, result := range results {
				status := "✅"
				if !result.Passed {
					status = "❌"
				}
				fmt.Printf("\n%s %s@%s\n", status, result.PackID, result.Version)
				if result.ScoreReport != nil {
					fmt.Printf("   Score: %.1f/100 (%s)\n", result.ScoreReport.Overall, result.ScoreReport.Grade)
				}
				if len(result.Errors) > 0 {
					for _, err := range result.Errors {
						fmt.Printf("   Error: %s\n", err)
					}
				}
			}
		}
	}

	// Exit with error if any packs failed
	if failed > 0 {
		os.Exit(1)
	}

	return nil
}

// RunRegistryPR is the entry point for the registry PR command.
func RunRegistryPR(args []string, jsonOutput bool) error {
	registryDir := "."
	if len(args) > 0 {
		registryDir = args[0]
	}

	cmd := NewRegistryPRCommand(registryDir)
	cmd.OutputJSON = jsonOutput

	return cmd.Execute()
}

// PrintRegistryPRHelp prints help for the registry PR command.
func PrintRegistryPRHelp() {
	fmt.Println("Usage: reach verify:registry-pr [path] [options]")
	fmt.Println("")
	fmt.Println("Validate all packs in a registry PR.")
	fmt.Println("")
	fmt.Println("Options:")
	fmt.Println("  --json          Output results as JSON")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  reach verify:registry-pr")
	fmt.Println("  reach verify:registry-pr ./registry --json")
}