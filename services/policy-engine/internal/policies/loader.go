package policies

import (
	"os"
	"path/filepath"

	"reach/internal/packkit/manifest"
)

func LoadBundles(root string) ([]manifest.Manifest, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	out := make([]manifest.Manifest, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, entry.Name(), "manifest.json"))
		if err != nil {
			continue
		}
		m, err := manifest.ParseManifest(data)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}
