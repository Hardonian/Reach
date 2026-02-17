package lockfile

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const CurrentSchemaVersion = 1

type Entry struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Hash    string `json:"hash"`
}

type Lockfile struct {
	SchemaVersion int     `json:"schema_version,omitempty"`
	Packages      []Entry `json:"packages"`
}

func Read(path string) (Lockfile, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if os.IsNotExist(err) {
		return Lockfile{SchemaVersion: CurrentSchemaVersion}, nil
	}
	if err != nil {
		return Lockfile{}, err
	}
	var lf Lockfile
	if err := json.Unmarshal(data, &lf); err != nil {
		return Lockfile{}, err
	}
	if lf.SchemaVersion == 0 {
		lf.SchemaVersion = CurrentSchemaVersion
	}
	return lf, nil
}

func Write(path string, lf Lockfile) error {
	if lf.SchemaVersion == 0 {
		lf.SchemaVersion = CurrentSchemaVersion
	}
	if lf.Packages == nil {
		lf.Packages = []Entry{}
	}
	data, err := json.MarshalIndent(lf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Clean(path), append(data, '\n'), 0o644)
}
