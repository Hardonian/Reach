package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"

	"reach/services/runner/internal/determinism"
)

// runSelfTest executes the deterministic self-test suite.
// This runs 200 iterations of key operations to verify identical digest output.
func runSelfTest(ctx context.Context, dataRoot string, args []string, out io.Writer, errOut io.Writer) int {
	fs := flag.NewFlagSet("self-test", flag.ContinueOnError)
	n := fs.Int("n", 200, "number of iterations per operation")
	verbose := fs.Bool("v", false, "verbose output")
	jsonOutput := fs.Bool("json", false, "output as JSON")
	_ = fs.Parse(args)

	iterations := *n

	fmt.Fprintf(out, "Running determinism self-test (iterations=%d)...\n", iterations)

	// Create the self-test runner
	runner := determinism.NewSelfTestRunner()
	runner.Iterations = iterations
	runner.Verbose = *verbose

	result := runner.Run()

	if *jsonOutput {
		// Output as JSON
		b, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			fmt.Fprintf(errOut, "Error marshaling JSON: %v\n", err)
			return 1
		}
		fmt.Fprintf(out, "\n%s\n", string(b))
	} else {
		// Output human-readable format
		fmt.Fprintf(out, "\n%s\n", result.FormatResult())
	}

	if !result.Passed {
		fmt.Fprintf(errOut, "\n✗ Self-test FAILED: drift detected\n")
		if len(result.FailureDetails) > 0 {
			fmt.Fprintf(errOut, "\nFailure details:\n")
			for _, f := range result.FailureDetails {
				fmt.Fprintf(errOut, "  - %s: %s\n", f.Operation, f.Description)
			}
		}
		return 1
	}

	fmt.Fprintf(out, "\n✓ All self-tests PASSED\n")
	return 0
}
