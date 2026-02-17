package lockfile

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Entry struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Hash    string `json:"hash"`
}

type Lockfile struct {
	Packages []Entry `json:"packages"`
}

func Read(path string) (Lockfile, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if os.IsNotExist(err) {
		return Lockfile{}, nil
	}
	if err != nil {
		return Lockfile{}, err
	}
	var lf Lockfile
	if err := json.Unmarshal(data, &lf); err != nil {
		return Lockfile{}, err
	}
	return lf, nil
}

func Write(path string, lf Lockfile) error {
	data, err := json.MarshalIndent(lf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Clean(path), append(data, '\n'), 0o644)
}
