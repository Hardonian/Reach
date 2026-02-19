// Package pack provides pack scoring CLI commands.
package pack

import (
	"fmt"
	"os"
	"path/filepath"

	"reach/pack-devkit/harness"
)

// ScoreCommand handles the 'reach pack score' command.
type ScoreCommand struct {
	PackPath    string
	OutputJSON  bool
	ShowBadges  bool
	FixturesDir string
}

// NewScoreCommand creates a new score command.
func NewScoreCommand(packPath string) *ScoreCommand {
	return &ScoreCommand{
		PackPath:    packPath,
		FixturesDir: filepath.Join(packPath, "..", "fixtures"),
	}
}

// Execute runs the scoring command.
func (c *ScoreCommand) Execute() error {
	// Verify pack exists
	packJSONPath := filepath.Join(c.PackPath, "pack.json")
	if _, err := os.Stat(packJSONPath); os.IsNotExist(err) {
		return fmt.Errorf("pack.json not found at %s", c.PackPath)
	}

	// Create scorer
	scorer := harness.NewScorer(c.FixturesDir)

	// Run scoring
	report, err := scorer.ScorePack(c.PackPath)
	if err != nil {
		return fmt.Errorf("scoring failed: %w", err)
	}

	// Output results
	if c.OutputJSON {
		data, err := report.ToJSON()
		if err != nil {
			return fmt.Errorf("failed to serialize report: %w", err)
		}
		fmt.Println(string(data))
	} else {
		fmt.Println(report.ToHuman())
	}

	// Exit with error code if grade is "needs_work"
	if report.Grade == "needs_work" {
		os.Exit(1)
	}

	return nil
}

// ScoreFlags represents command-line flags for scoring.
type ScoreFlags struct {
	JSON     bool   `json:"json"`
	Badges   bool   `json:"badges"`
	Fixtures string `json:"fixtures"`
}

// RunScore is the entry point for the score command.
func RunScore(args []string, flags ScoreFlags) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: reach pack score <path> [--json] [--badges] [--fixtures <dir>]")
	}

	packPath := args[0]
	cmd := NewScoreCommand(packPath)
	cmd.OutputJSON = flags.JSON
	cmd.ShowBadges = flags.Badges
	if flags.Fixtures != "" {
		cmd.FixturesDir = flags.Fixtures
	}

	return cmd.Execute()
}

// PrintScoreHelp prints help for the score command.
func PrintScoreHelp() {
	fmt.Println("Usage: reach pack score <path> [options]")
	fmt.Println("")
	fmt.Println("Options:")
	fmt.Println("  --json          Output results as JSON")
	fmt.Println("  --badges        Include badge generation")
	fmt.Println("  --fixtures      Path to fixtures directory")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  reach pack score ./my-pack")
	fmt.Println("  reach pack score ./my-pack --json")
	fmt.Println("  reach pack score ./my-pack --fixtures ./fixtures")
}
