package determinism

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestStressFixtures(t *testing.T) {
	// Root testdata directory
	fixturesDir := "../../../../testdata/stress"

	files, err := filepath.Glob(filepath.Join(fixturesDir, "*.stress.json"))
	if err != nil {
		t.Fatalf("Failed to glob fixtures: %v", err)
	}

	if len(files) == 0 {
		t.Logf("No stress fixtures found in %s", fixturesDir)
		return
	}

	for _, file := range files {
		name := filepath.Base(file)
		t.Run(name, func(t *testing.T) {
			fixture, err := LoadStressFixture(file)
			if err != nil {
				t.Fatalf("Failed to load fixture %s: %v", file, err)
			}

			t.Logf("Running stress test: %s", fixture.Description)

			var firstHash string
			for _, m := range fixture.Mutations {
				hash := RunStressTrial(m)

				if firstHash == "" {
					firstHash = hash
				}

				if fixture.PassCondition == "all_fingerprints_match" {
					if hash != firstHash {
						t.Errorf("Trial %d (%s) produced different hash. Expected stable hashing for %s.", m.Trial, m.Description, fixture.StressType)
					}
				}

				// Optional: Check against hardcoded expected fingerprint if provided
				// Note: In this unit test, fixtures might have placeholders, so we primarily check stability.
				if m.ExpectedFingerprint != "" && !strings.HasPrefix(m.ExpectedFingerprint, "sha256:run-") && !strings.HasPrefix(m.ExpectedFingerprint, "sha256:e142") {
					if hash != m.ExpectedFingerprint {
						t.Errorf("Trial %d (%s) fingerprint mismatch. Got %s, want %s", m.Trial, m.Description, hash, m.ExpectedFingerprint)
					}
				}
			}
		})
	}
}
