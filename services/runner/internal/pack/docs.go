// Package pack provides pack documentation CLI commands.
package pack

import (
	"fmt"
	"os"
	"path/filepath"

	"reach/pack-devkit/harness"
)

// DocsCommand handles the 'reach pack docs' command.
type DocsCommand struct {
	PackPath       string
	OutputPath     string
	WithScores     bool
	RegistryFormat bool
}

// NewDocsCommand creates a new docs command.
func NewDocsCommand(packPath string) *DocsCommand {
	return &DocsCommand{
		PackPath:   packPath,
		OutputPath: filepath.Join(packPath, "README.md"),
	}
}

// Execute runs the docs command.
func (c *DocsCommand) Execute() error {
	// Verify pack exists
	packJSONPath := filepath.Join(c.PackPath, "pack.json")
	if _, err := os.Stat(packJSONPath); os.IsNotExist(err) {
		return fmt.Errorf("pack.json not found at %s", c.PackPath)
	}

	// Create docs generator
	generator := harness.NewDocsGenerator("")

	// Generate docs
	docs, err := generator.GenerateDocs(c.PackPath, c.WithScores)
	if err != nil {
		return fmt.Errorf("documentation generation failed: %w", err)
	}

	// Generate markdown
	markdown := generator.GenerateMarkdown(docs)

	// Write output
	if err := os.WriteFile(c.OutputPath, []byte(markdown), 0644); err != nil {
		return fmt.Errorf("failed to write documentation: %w", err)
	}

	fmt.Printf("Documentation generated: %s\n", c.OutputPath)
	return nil
}

// DocsFlags represents command-line flags for docs.
type DocsFlags struct {
	Output     string `json:"output"`
	WithScores bool   `json:"with_scores"`
	Registry   bool   `json:"registry"`
}

// RunDocs is the entry point for the docs command.
func RunDocs(args []string, flags DocsFlags) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: reach pack docs <path> [--output <path>] [--with-scores]")
	}

	packPath := args[0]
	cmd := NewDocsCommand(packPath)
	cmd.WithScores = flags.WithScores
	cmd.RegistryFormat = flags.Registry
	if flags.Output != "" {
		cmd.OutputPath = flags.Output
	}

	return cmd.Execute()
}

// PrintDocsHelp prints help for the docs command.
func PrintDocsHelp() {
	fmt.Println("Usage: reach pack docs <path> [options]")
	fmt.Println("")
	fmt.Println("Options:")
	fmt.Println("  --output       Output file path (default: <pack>/README.md)")
	fmt.Println("  --with-scores  Include scoring results in documentation")
	fmt.Println("  --registry     Generate in registry format")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  reach pack docs ./my-pack")
	fmt.Println("  reach pack docs ./my-pack --output ./docs/mypack.md")
	fmt.Println("  reach pack docs ./my-pack --with-scores")
}