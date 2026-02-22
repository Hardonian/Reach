package determinism

import (
	"fmt"
	"io"
)

// DeterminismReporter interface for progress reporting.
type DeterminismReporter interface {
	ReportTrial(n int, hash string)
}

// VerifyDeterminism executes a trial function N times and compares output hashes.
func VerifyDeterminism(n int, trial func() (string, error), reporter DeterminismReporter) (string, error) {
	if n < 2 {
		return "", fmt.Errorf("verify-determinism requires at least 2 trials, got %d", n)
	}

	var firstHash string
	for i := 0; i < n; i++ {
		hash, err := trial()
		if err != nil {
			return "", fmt.Errorf("trial %d failed: %w", i, err)
		}

		if reporter != nil {
			reporter.ReportTrial(i, hash)
		}

		if firstHash == "" {
			firstHash = hash
		} else if firstHash != hash {
			return firstHash, fmt.Errorf("nondeterminism detected at trial %d: hash mismatch (orig: %s, new: %s)", i, firstHash, hash)
		}
	}

	return firstHash, nil
}

// StdoutReporter prints progress to an io.Writer.
type StdoutReporter struct {
	Out io.Writer
}

func (r *StdoutReporter) ReportTrial(n int, hash string) {
	fmt.Fprintf(r.Out, "Trial %d: %s\n", n+1, hash)
}
