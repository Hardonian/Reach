package determinism

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type StressFixture struct {
	Name     string           `json:"name"`
	Inputs   []map[string]any `json:"inputs"`
	Expected string           `json:"expected_hash"`
}

func TestStress(t *testing.T) {
	fixturesDir := "../../../../testdata/stress"
	files, err := os.ReadDir(fixturesDir)
	if os.IsNotExist(err) {
		t.Skip("stress fixtures not found")
	}
	if err != nil {
		t.Fatal(err)
	}

	for _, f := range files {
		if filepath.Ext(f.Name()) != ".json" {
			continue
		}
		t.Run(f.Name(), func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join(fixturesDir, f.Name()))
			if err != nil {
				t.Fatal(err)
			}
			var fixture StressFixture
			if err := json.Unmarshal(data, &fixture); err != nil {
				t.Fatal(err)
			}

			for i, input := range fixture.Inputs {
				hash := Hash(input)
				if hash != fixture.Expected {
					t.Errorf("input %d mismatch: got %s, want %s", i, hash, fixture.Expected)
				}
			}
		})
	}
}
