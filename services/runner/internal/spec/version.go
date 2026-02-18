package spec

import (
	"fmt"
	"strconv"
	"strings"
)

const Version = "1.0.0"

func IsCompatible(version string) bool {
	return CompatibleError(version) == nil
}

func CompatibleError(version string) error {
	if strings.TrimSpace(version) == "" {
		return fmt.Errorf("spec version is required")
	}

	expectedMajor, err := major(Version)
	if err != nil {
		return fmt.Errorf("runner spec version is invalid: %w", err)
	}

	actualMajor, err := major(version)
	if err != nil {
		return fmt.Errorf("spec version is invalid: %w", err)
	}

	if actualMajor != expectedMajor {
		return fmt.Errorf("incompatible spec version %q: expected major %d", version, expectedMajor)
	}
	return nil
}

func major(version string) (int, error) {
	parts := strings.Split(strings.TrimSpace(version), ".")
	if len(parts) < 1 || parts[0] == "" {
		return 0, fmt.Errorf("%q", version)
	}
	m, err := strconv.Atoi(parts[0])
	if err != nil || m < 0 {
		return 0, fmt.Errorf("%q", version)
	}
	return m, nil
}
