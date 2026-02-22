package determinism

import (
	"fmt"
	"io"
)

type Reporter interface {
	Report(trial int, hash string)
}

type StdoutReporter struct {
	Out io.Writer
}

func (r *StdoutReporter) Report(trial int, hash string) {
	fmt.Fprintf(r.Out, "Trial %d: %s\n", trial, hash)
}

func VerifyDeterminism(n int, trialFunc func() (string, error), reporter Reporter) (string, error) {
	var firstHash string
	for i := 0; i < n; i++ {
		hash, err := trialFunc()
		if err != nil {
			return "", err
		}
		if reporter != nil {
			reporter.Report(i+1, hash)
		}
		if i == 0 {
			firstHash = hash
		} else if hash != firstHash {
			return "", fmt.Errorf("determinism failure: trial %d hash %s != trial 1 hash %s", i+1, hash, firstHash)
		}
	}
	return firstHash, nil
}
